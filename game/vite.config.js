import { execSync } from "node:child_process"

export default () => {
    process.env.VITE_GIT_HASH = execSync("git rev-parse --short HEAD")
        .toString()
        .trimEnd()
    process.env.VITE_GIT_HASH_LONG = execSync("git rev-parse HEAD")
        .toString()
        .trimEnd()
    return {}
}
