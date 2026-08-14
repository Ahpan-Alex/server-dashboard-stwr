import { loadEnv, env } from "./config.js";
import { buildApp } from "./app.js";

async function main() {
  loadEnv();
  const app = await buildApp({ logger: true });
  const port = env().PORT;
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`STWR API listening on :${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
