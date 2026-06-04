import "./index.scss"
setTimeout(() => {
    document.getElementById("splash").classList.remove("show")
    document.getElementById("title-screen").classList.add("show")
}, 3000)
if (sessionStorage.getItem("indev-notif-dismissed") == "true") {
    document.getElementById("indev-notif").style.display = "none"
}
document.getElementById("indev-notif").addEventListener("click", () => {
    document.getElementById("indev-notif").classList.add("dismissed")
    sessionStorage.setItem("indev-notif-dismissed", "true")
})
