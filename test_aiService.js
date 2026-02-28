const aiService = require('./dist/services/aiService');

async function test() {
    await aiService.initializeModel({ phone: "573143855079", current_step: "SALUDO" });
    const resp = await aiService.generateResponse("Buen dia");
    console.log(resp.text);
}

test().catch(e => console.error("Error", e));
