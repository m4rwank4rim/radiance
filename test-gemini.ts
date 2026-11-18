import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

async function test(apiVersion: string, modelName: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No GEMINI_API_KEY found in .env");
        return;
    }

    try {
        console.log(`\n--- Testing ${apiVersion} with ${modelName} ---`);
        const genAI = new GoogleGenAI({ apiKey, apiVersion });

        const result = await genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: "Say hello in one word." }] }]
        });

        console.log("SUCCESS:", result.text);
    } catch (err: any) {
        console.log("FAILED:");
        console.log("Message:", err.message);
        if (err.error) console.log("Error details:", JSON.stringify(err.error));
    }
}

async function runTests() {
    await test("v1beta", "gemini-2.5-flash");
    await test("v1beta", "gemini-2.0-flash");
    await test("v1beta", "gemini-pro");
}

runTests();
