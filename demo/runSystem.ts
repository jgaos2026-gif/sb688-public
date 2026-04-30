import { startSystemServer } from "../src/server/SystemServer";

const proc = process as NodeJS.Process;
startSystemServer({
  host: proc.env["SB689_HOST"] ?? "127.0.0.1",
  port: Number(proc.env["SB689_PORT"] ?? 6890)
});
