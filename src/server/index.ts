if (process.argv.includes('--update')) {
    let { updateApp } = await import("./updater")
    await updateApp()
} else {
    let { startApp } = await import("./app")
    await startApp()
}
