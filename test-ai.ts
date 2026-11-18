import dotenv from "dotenv";
import Groq from "groq-sdk";
import fs from "fs";

dotenv.config();

async function test() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) { fs.writeFileSync('err.json', JSON.stringify({ message: "No GROQ_API_KEY" })); return; }

    try {
        const groq = new Groq({ apiKey });
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: "Say hello in one word." }],
            max_tokens: 10,
        });
        const text = completion.choices[0]?.message?.content;
        fs.writeFileSync('err.json', JSON.stringify({ success: true, text }, null, 2));
    } catch (err: any) {
        fs.writeFileSync('err.json', JSON.stringify({
            message: err.message,
            stack: err.stack?.split('\n').slice(0, 4).join('\n')
        }, null, 2));
    }
}

test();
