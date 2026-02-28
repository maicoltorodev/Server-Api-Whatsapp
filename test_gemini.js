const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
    const genAI = new GoogleGenerativeAI('AIzaSyA4eD1pzu9Fe0dz8EqWd1bLzGSc1FRGip8');
    const model = genAI.getGenerativeModel({
        model: "gemini-flash-latest"
    });

    try {
        const result = await model.generateContent("Hola");
        console.log(result.response.text());
    } catch (e) {
        console.error("ERROR:", e.message);
    }
}

test();
