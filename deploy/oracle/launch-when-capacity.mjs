#!/usr/bin/env node
/**
 * Retries an Oracle Cloud "Always Free" Ampere A1 launch until capacity exists.
 *
 * Usage:
 *   node deploy/oracle/launch-when-capacity.mjs
 *
 * Config: deploy/oracle/config.json (copy config.example.json).
 * Needs only Node 18+ — no npm packages, no OCI CLI.
 *
 * Stop with Ctrl+C. On success it prints the instance OCID and exits.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const cfgPath = process.env.OCI_CONFIG || path.join(here, "config.json");

if (!fs.existsSync(cfgPath)) {
  console.error(`Missing ${cfgPath}\nCopy config.example.json to config.json and fill it in.`);
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
for (const k of ["tenancyOcid", "userOcid", "fingerprint", "privateKeyPath", "region"]) {
  if (!cfg[k]) {
    console.error(`config.json is missing "${k}"`);
    process.exit(1);
  }
}

const privKey = crypto.createPrivateKey(
  fs.readFileSync(path.resolve(here, cfg.privateKeyPath), "utf8"),
);

const host = `iaas.${cfg.region}.oraclecloud.com`;
const intervalMs = Number(cfg.intervalSeconds ?? 60) * 1000;
const configs = cfg.shapeConfigs ?? [
  { ocpus: 2, memoryInGBs: 12 },
  { ocpus: 1, memoryInGBs: 6 },
];

function signedHeaders(method, urlPath, body) {
  const date = new Date().toUTCString();
  const headers = { host, date };

  let signed = "host date";
  let stringToSign = `${method.toLowerCase()} ${urlPath}\nhost: ${host}\ndate: ${date}`;

  if (body !== undefined) {
    const payload = JSON.stringify(body);
    const sha = crypto.createHash("sha256").update(payload).digest("base64");
    headers["content-type"] = "application/json";
    headers["content-length"] = String(Buffer.byteLength(payload));
    headers["x-content-sha256"] = sha;
    signed = "host date content-length content-type x-content-sha256";
    stringToSign +=
      `\ncontent-length: ${headers["content-length"]}` +
      `\ncontent-type: application/json` +
      `\nx-content-sha256: ${sha}`;
  }

  headers.authorization =
    `Signature version="1",keyId="${cfg.tenancyOcid}/${cfg.userOcid}/${cfg.fingerprint}",` +
    `algorithm="rsa-sha256",headers="${signed}",` +
    `signature="${crypto.sign("rsa-sha256", Buffer.from(stringToSign), privKey).toString("base64")}"`;

  return headers;
}

function oci(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const headers = signedHeaders(method, urlPath, body);
    const req = https.request({ host, path: urlPath, method, headers }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        let json = null;
        try {
          json = data ? JSON.parse(data) : null;
        } catch {
          /* non-JSON error page */
        }
        resolve({ status: res.statusCode, json, text: data });
      });
    });
    req.on("error", reject);
    req.setTimeout(30_000, () => req.destroy(new Error("request timeout")));
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

const compartment = cfg.compartmentOcid || cfg.tenancyOcid;

async function discover() {
  const adRes = await oci("GET", `/20160918/availabilityDomains?compartmentId=${compartment}`);
  if (adRes.status !== 200) throw new Error(`availabilityDomains: HTTP ${adRes.status} ${adRes.text}`);
  const ads = adRes.json.map((a) => a.name).sort();

  let subnetId = cfg.subnetId;
  if (!subnetId) {
    const s = await oci("GET", `/20160918/subnets?compartmentId=${compartment}&lifecycleState=AVAILABLE`);
    if (s.status !== 200) throw new Error(`subnets: HTTP ${s.status} ${s.text}`);
    subnetId = s.json[0]?.id;
    if (!subnetId) {
      throw new Error(
        "No subnet found. Create one first: Networking > Virtual Cloud Networks > Start VCN Wizard (VCN with Internet Connectivity).",
      );
    }
  }

  let imageId = cfg.imageId;
  if (!imageId) {
    for (const version of ["24.04", "22.04", ""]) {
      const q =
        `/20160918/images?compartmentId=${compartment}` +
        `&shape=VM.Standard.A1.Flex&operatingSystem=Canonical%20Ubuntu` +
        (version ? `&operatingSystemVersion=${version}` : "") +
        `&sortBy=TIMECREATED&sortOrder=DESC`;
      const r = await oci("GET", q);
      if (r.status === 200 && r.json?.length) {
        imageId = r.json[0].id;
        break;
      }
    }
    if (!imageId) throw new Error("Could not find an Ubuntu ARM image for VM.Standard.A1.Flex.");
  }

  return { ads, subnetId, imageId };
}

const log = (msg) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

async function main() {
  log(`Region ${cfg.region} — discovering ADs, subnet, image...`);
  const { ads, subnetId, imageId } = await discover();
  log(`ADs:    ${ads.join(", ")}`);
  log(`Subnet: ${subnetId}`);
  log(`Image:  ${imageId}`);
  log(
    `Trying ${ads.length} AD(s) x ${configs.length} shape config(s) every ${intervalMs / 1000}s. Ctrl+C to stop.`,
  );

  for (let round = 1; ; round++) {
    for (const ad of ads) {
      for (const shapeConfig of configs) {
        const body = {
          compartmentId: compartment,
          availabilityDomain: ad,
          shape: "VM.Standard.A1.Flex",
          shapeConfig,
          displayName: cfg.displayName || "radiance",
          sourceDetails: { sourceType: "image", imageId },
          subnetId,
        };
        if (cfg.sshPublicKey) body.metadata = { ssh_authorized_keys: cfg.sshPublicKey };

        const r = await oci("POST", "/20160918/instances", body);
        const label = `${ad.replace(/.*-AD-/, "AD-")} ${shapeConfig.ocpus} OCPU/${shapeConfig.memoryInGBs} GB`;

        if (r.status === 200 && r.json?.id) {
          log(`SUCCESS — ${label}`);
          log(`Instance: ${r.json.id}`);
          log(`State:    ${r.json.lifecycleState}`);
          return;
        }

        const msg = r.json?.message || r.text || `HTTP ${r.status}`;
        if (/out of host capacity|out of capacity/i.test(msg)) {
          log(`full:   ${label}`);
        } else if (/quota|limit/i.test(msg) && /exceed/i.test(msg)) {
          log(`quota:  ${label} — ${msg}`);
          console.error("\nQuota exceeded. Retrying will not help on this account.");
          process.exit(2);
        } else {
          log(`error:  ${label} — HTTP ${r.status} ${msg.slice(0, 200)}`);
        }
      }
    }
    log(`round ${round} done, sleeping ${intervalMs / 1000}s`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
