import path from "path";

function resolvePath(defaultPath, envName) {
  const override = process.env[envName];
  if (!override) return defaultPath;
  return path.isAbsolute(override) ? override : path.resolve(process.cwd(), override);
}

export function getStateFilePath() {
  return resolvePath("./state.json", "HELIX_STATE_FILE");
}

export function getRuntimeDataDir() {
  return resolvePath("./runtime-data", "HELIX_RUNTIME_DATA_DIR");
}

export function getRuntimeDataFile(name, envName) {
  return resolvePath(path.join(getRuntimeDataDir(), name), envName);
}
