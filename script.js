document.addEventListener('DOMContentLoaded', function () {
    // === Set minimum date ===
    const dateInput = document.getElementById('date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);

    // === Mobile Nav Toggle ===
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    navToggle.addEventListener('click', function () {
        const open = navLinks.classList.toggle('open');
        navToggle.setAttribute('aria-expanded', open);
        navToggle.querySelector('i').className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    });
    // Close nav on link click
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('open');
            navToggle.setAttribute('aria-expanded', 'false');
            navToggle.querySelector('i').className = 'fa-solid fa-bars';
        });
    });

    // === Booking Form Submit ===
    const bookingForm = document.getElementById('bookingForm');
    bookingForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!bookingForm.checkValidity()) {
            bookingForm.reportValidity();
            return;
        }
        const formData = {
            name: document.getElementById('name').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            serviceType: document.getElementById('serviceType').value,
            vehicleType: document.getElementById('vehicleType').value,
            pickupAddress: document.getElementById('pickupAddress').value.trim(),
            destination: document.getElementById('destination').value.trim(),
            date: document.getElementById('date').value,
            time: document.getElementById('time').value,
            comments: document.getElementById('comments').value.trim()
        };
        submitToGoogleForms(formData);
    });

    // === Phone input: digits only, max 10 ===
    document.getElementById('phone').addEventListener('input', function (e) {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
    });

    // === Smooth scroll ===
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                const offset = target.getBoundingClientRect().top + window.pageYOffset - 80;
                window.scrollTo({ top: offset, behavior: 'smooth' });
            }
        });
    });
});

// === Google Forms submission ===
function submitToGoogleForms(data) {
    // Replace with your actual Google Form action URL and entry IDs
    const GOOGLE_FORM_ACTION_URL = 'YOUR_GOOGLE_FORM_ACTION_URL';
    const formParams = new URLSearchParams({
        'entry.NAME_ENTRY_ID': data.name,
        'entry.PHONE_ENTRY_ID': data.phone,
        'entry.SERVICE_ENTRY_ID': data.serviceType,
        'entry.VEHICLE_ENTRY_ID': data.vehicleType,
        'entry.PICKUP_ENTRY_ID': data.pickupAddress,
        'entry.DESTINATION_ENTRY_ID': data.destination,
        'entry.DATE_ENTRY_ID': data.date,
        'entry.TIME_ENTRY_ID': data.time,
        'entry.COMMENTS_ENTRY_ID': data.comments
    });
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.name = 'hidden_iframe';
    document.body.appendChild(iframe);
    const form = document.createElement('form');
    form.target = 'hidden_iframe';
    form.method = 'POST';
    form.action = GOOGLE_FORM_ACTION_URL;
    formParams.forEach((value, key) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
    showSuccessMessage();
    setTimeout(() => {
        document.body.removeChild(form);
        document.body.removeChild(iframe);
    }, 1000);
}

// === Success message ===
function showSuccessMessage() {
    let msg = document.querySelector('.success-message');
    if (!msg) {
        msg = document.createElement('div');
        msg.className = 'success-message';
        const form = document.getElementById('bookingForm');
        form.insertBefore(msg, form.firstChild);
    }
    msg.innerHTML = '<strong>&#10003; Booking Request Submitted!</strong><p>Thank you! We will call you shortly to confirm your ride.</p>';
    msg.classList.add('show');
    document.getElementById('bookingForm').reset();
    msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => msg.classList.remove('show'), 6000);
}