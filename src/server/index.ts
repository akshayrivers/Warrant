import "dotenv/config";
import { buildApp } from "./app.js";

const port = Number(process.env["PORT"] ?? 3000);
const host = process.env["HOST"] ?? "0.0.0.0";

const server = buildApp();

server.listen({ port, host }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🛡️  Warrant authorization server listening at ${address}`);
});
