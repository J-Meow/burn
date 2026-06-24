import "./index.scss"
if (sessionStorage.getItem("nosplash") == "true") {
    document.getElementById("splash").style.display = "none"
    document.getElementById("title-screen").classList.add("show")
} else {
    setTimeout(() => {
        document.getElementById("splash").classList.remove("show")
        document.getElementById("title-screen").classList.add("show")
    }, 3000)
}
document.getElementById("title-screen--play").addEventListener("click", () => {
    document.getElementById("title-screen").classList.remove("show")
    document.getElementById("ingame").classList.add("show")
})
if (sessionStorage.getItem("indev-notif-dismissed") == "true") {
    document.getElementById("indev-notif").style.display = "none"
}
document.getElementById("indev-notif").addEventListener("click", () => {
    document.getElementById("indev-notif").classList.add("dismissed")
    sessionStorage.setItem("indev-notif-dismissed", "true")
})
