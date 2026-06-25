import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

const server = http.createServer(function(req, res){
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  let safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  if(safePath.endsWith(path.sep)){
    safePath += "index.html";
  }
  const filePath = path.join(rootDir, safePath === path.sep ? "index.html" : safePath);
  if(!filePath.startsWith(rootDir)){
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, function(err, data){
    if(err){
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(0, "127.0.0.1", function(){
  const port = server.address().port;
  const baseUrl = "http://127.0.0.1:" + port;
  const child = spawn(process.execPath, ["scripts/capture-estimate-gh-verify.mjs"], {
    cwd: rootDir,
    env: Object.assign({}, process.env, { ESTIMATE_BASE_URL: baseUrl }),
    stdio: "inherit"
  });
  child.on("exit", function(code){
    server.close();
    process.exit(code || 0);
  });
});
