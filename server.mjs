import "dotenv/config";
import Server from "./src/server.mjs";

const server = new Server();
await server.run();