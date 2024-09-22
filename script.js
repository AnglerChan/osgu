function saveID() {
    const userid = document.getElementById('userid').value;
    localStorage.setItem('userid', userid);
    showID();
}

function showID() {
    const savedID = localStorage.getItem("userid");
    if (savedID) {
        document.getElementById("greeting").innerText = `欢迎，${savedID}!`; // 使用反引号
    }
}

window.onload = showID;
