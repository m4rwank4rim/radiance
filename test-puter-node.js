Object.defineProperty(global, 'navigator', { value: { userAgent: 'Node.js' }, writable: true, configurable: true });
global.window = global;
global.document = {
    location: { href: 'http://localhost' },
    createElement: () => ({ setAttribute: () => { }, appendChild: () => { }, style: {} }),
    head: { appendChild: () => { } },
    readyState: 'complete',
    body: { appendChild: () => { } },
    cookie: ''
};
global.localStorage = { getItem: () => null, setItem: () => { }, removeItem: () => { } };

(async () => {
    try {
        const puter = (await import('./puter.js')).default;
        console.log("Puter loaded:", typeof puter !== 'undefined');
        console.log("Puter keys:", Object.keys(puter));
        console.log("Puter object:", puter);
        if (typeof puter !== 'undefined') {
            puter.ai.chat("Say hello!", { model: 'gemini-3-flash-preview' })
                .then(res => console.log("SUCCESS:", res))
                .catch(err => console.error("ERROR:", err));
        }
    } catch (e) {
        console.error("Error loading puter:", e);
    }
})();
