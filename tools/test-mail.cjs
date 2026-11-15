const esbuild = require("esbuild");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
(async () => {
  fs.mkdirSync(".tmp", { recursive: true });
  await esbuild.build({
    entryPoints: ["tests/mail-security.test.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: ".tmp/mail-security.test.cjs",
  });
  await esbuild.build({
    entryPoints: ["tests/mail-routes.test.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: ".tmp/mail-routes.test.cjs",
    plugins: [
      {
        name: "isolated-mail-test-services",
        setup(build) {
          build.onResolve({ filter: /^next\/(cache|navigation)$/ }, (args) => ({
            path: args.path,
            namespace: "mock-next",
          }));
          build.onLoad({ filter: /.*/, namespace: "mock-next" }, () => ({
            contents:
              'export const revalidatePath=()=>{}; export const redirect=(url)=>{throw new Error("Redirect: "+url)};',
            loader: "js",
          }));
          build.onResolve({ filter: /^@\/lib\/supabase\/server$/ }, (args) => ({
            path: args.path,
            namespace: "mock-db",
          }));
          build.onResolve({ filter: /^@supabase\/supabase-js$/ }, (args) => ({
            path: args.path,
            namespace: "mock-admin",
          }));
          build.onResolve(
            { filter: /^@\/lib\/microsoft\/session$/ },
            (args) => ({ path: args.path, namespace: "mock-token" }),
          );
          build.onLoad({ filter: /.*/, namespace: "mock-db" }, () => ({
            contents:
              "export async function createClient(){return globalThis.__mailFixture.db}",
            loader: "js",
          }));
          build.onLoad({ filter: /.*/, namespace: "mock-admin" }, () => ({
            contents:
              "export function createClient(){return globalThis.__mailFixture.admin}",
            loader: "js",
          }));
          build.onLoad({ filter: /.*/, namespace: "mock-token" }, () => ({
            contents:
              "export async function getMicrosoftAccessToken(userId){return globalThis.__mailFixture.token(userId)}",
            loader: "js",
          }));
        },
      },
    ],
  });
  await esbuild.build({
    entryPoints: ["tests/mail-automation.test.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: ".tmp/mail-automation.test.cjs",
  });
  await esbuild.build({
    entryPoints: ["tests/mail-analysis.test.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: ".tmp/mail-analysis.test.cjs",
  });
  await esbuild.build({ entryPoints: ["tests/mail-combined-inbox.test.ts"], bundle: true, platform: "node", format: "cjs", outfile: ".tmp/mail-combined-inbox.test.cjs" });
  await esbuild.build({ entryPoints: ["tests/mail-received.test.ts"], bundle: true, platform: "node", format: "cjs", outfile: ".tmp/mail-received.test.cjs" });
  await esbuild.build({ entryPoints: ["tests/mail-session-cache.test.ts"], bundle: true, platform: "node", format: "cjs", outfile: ".tmp/mail-session-cache.test.cjs" });
  await esbuild.build({ entryPoints: ["tests/mail-folder-sync.test.ts"], bundle: true, platform: "node", format: "cjs", outfile: ".tmp/mail-folder-sync.test.cjs" });
  await esbuild.build({ entryPoints: ["tests/mail-contact-names.test.ts"], bundle: true, platform: "node", format: "cjs", outfile: ".tmp/mail-contact-names.test.cjs" });
  await esbuild.build({ entryPoints: ["tests/mail-recipient-contacts.test.ts"], bundle: true, platform: "node", format: "cjs", outfile: ".tmp/mail-recipient-contacts.test.cjs" });
  const result = spawnSync(
    process.execPath,
    [
      "--test",
      ".tmp/mail-security.test.cjs",
      ".tmp/mail-combined-inbox.test.cjs",
      ".tmp/mail-received.test.cjs",
      ".tmp/mail-session-cache.test.cjs",
      ".tmp/mail-folder-sync.test.cjs",
      ".tmp/mail-contact-names.test.cjs",
      ".tmp/mail-recipient-contacts.test.cjs",
      ".tmp/mail-routes.test.cjs",
      ".tmp/mail-automation.test.cjs",
      ".tmp/mail-analysis.test.cjs",
    ],
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
