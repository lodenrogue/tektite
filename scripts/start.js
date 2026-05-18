const path = require("path");
const { spawn } = require("child_process");
const { packager } = require("@electron/packager");

const root = path.join(__dirname, "..");

async function main() {
  if (process.platform !== "darwin") {
    await run("npx", ["electron", "."], root);
    return;
  }

  const out = path.join(root, ".tektite-run");
  const appPaths = await packager({
    dir: root,
    name: "Tektite",
    platform: "darwin",
    arch: process.arch,
    electronVersion: require(path.join(root, "node_modules", "electron", "package.json")).version,
    icon: path.join(root, "assets", "icons", "tektite-icon"),
    overwrite: true,
    out,
    ignore: [
      /^\/\.tektite-run(\/|$)/,
      /^\/Tektite-darwin-(arm64|x64)(\/|$)/
    ]
  });

  const appPath = appPaths[0];
  console.log(`Launching ${appPath}`);

  if (process.env.TEKTITE_PACKAGE_ONLY === "1") return;
  await run(path.join(appPath, "Tektite.app", "Contents", "MacOS", "Tektite"), [], root);
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${signal || code}`));
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
