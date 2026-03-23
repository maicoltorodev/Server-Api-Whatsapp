import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

async function list() {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data: any = await response.json();
  if (data.models) {
    const names = data.models.map((m: any) => m.name);
    fs.writeFileSync('./models_output.txt', names.join('\n'));
    console.log("Wrote models to models_output.txt");
  } else {
    fs.writeFileSync('./models_output.txt', JSON.stringify(data));
    console.log("Wrote error to models_output.txt");
  }
}

list();
