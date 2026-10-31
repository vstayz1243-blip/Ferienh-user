// Formular-Validierung
function validateForm(): boolean {
    const name = document.getElementById('name') as HTMLInputElement;
    const email = document.getElementById('email') as HTMLInputElement;
    const message = document.getElementById('message') as HTMLTextAreaElement;

    if (!name.value.trim()) {
        showMessage('Name ist erforderlich', 'error');
        return false;
    }
    if (!email.value.includes('@')) {
        showMessage('Gültige E-Mail-Adresse erforderlich', 'error');
        return false;
    }
    if (!message.value.trim()) {
        showMessage('Nachricht ist erforderlich', 'error');
        return false;
    }

    return true;
}

// Nachricht im Formular anzeigen
function showMessage(message: string, type: 'success' | 'error') {
    const messageDiv = document.getElementById('formMessage') as HTMLDivElement;
    messageDiv.textContent = message;
    messageDiv.style.color = type === 'success' ? 'green' : 'red';
}

// Formular-Submit-Handler
document.getElementById('contactForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    const name = document.getElementById('name') as HTMLInputElement;
    const email = document.getElementById('email') as HTMLInputElement;
    const message = document.getElementById('message') as HTMLTextAreaElement;

    try {
        // Simuliere Backend-Anfrage (keine echte Anbindung)
        await new Promise(resolve => setTimeout(resolve, 1000));
        showMessage('Nachricht erfolgreich gesendet!', 'success');
        name.value = '';
        email.value = '';
        message.value = '';
    } catch (error) {
        console.error('Fehler:', error);
        showMessage('Fehler beim Senden der Nachricht', 'error');
    }
});
