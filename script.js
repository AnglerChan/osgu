function saveID() {
    const userid = document.getElementById('userid').value;
    const nickname = document.getElementById('nickname').value;

    if (!/^\d+$/.test(userid)) {
        openModal("Please enter a valid Student ID...");
        return;
    }

    if (!validID.includes(userid)) {
        openModal("This ID is not registered!");
        return;
    }

    localStorage.setItem('userid', userid);
    if (!localStorage.getItem('nickname')) {
        localStorage.setItem('nickname', nickname);
        openModal(`Your nickname has been set to: ${nickname}`, true); 
    } else {
        openModal(`Your nickname is already set to: ${localStorage.getItem('nickname')}`, true); // 显示按钮
    }
}

function goToNextPage() {
    const userid = localStorage.getItem('userid');
    const nickname = localStorage.getItem('nickname');
    if (userid && nickname) {
        window.location.href = 'main/home.html';
    }
}

function openModal(message, showButton = false) {
    const modal = document.getElementById("modal");
    const modalMessage = modal.querySelector("p");
    modalMessage.innerText = message;

    const confirmButton = document.getElementById("confirm-button");
    confirmButton.style.display = showButton ? 'block' : 'none';

    modal.style.visibility = 'visible';
    modal.classList.add("show");
}

function closeModal() {
    const modal = document.getElementById("modal");
    modal.classList.remove("show");
    modal.classList.add("fade-out");
    setTimeout(() => {
        modal.style.visibility = 'hidden';
        modal.classList.remove("fade-out");
    }, 200);
}

const validID = ["1193230231", "1060124224"];


