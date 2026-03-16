import { build, Glob, type Target } from "bun"
import { CURRENT_VERSION } from "./src/server/version"

let sqlFiles = await Array.fromAsync(new Glob('drizzle/**/*.sql').scan('.'))

let entrypoints = ['src/server/index.ts', ...sqlFiles]

let result = await build({
    entrypoints,
    target: 'bun-windows-x64' as Target,
    compile: {
        outfile: 'out/WebCaster.exe',
        windows: {
            title: 'WebCaster',
            description: 'WebCaster',
            icon: 'src/server/icon.ico',
            hideConsole: true,
            copyright: `${new Date().getFullYear()} Simon Oxtoby`,
            publisher: 'Simon Oxtoby',
            version: CURRENT_VERSION,
        },
    },
    naming: {
        asset: '[dir]/[name].[ext]'
    },
    define: {
        'process.env.NODE_ENV': '"production"',
    },
})

if (result.success) {
    console.log("Compiled out/WebCaster.exe")
} else {
    for (let log of result.logs)
        console.error(log)
    process.exit(1)
}
