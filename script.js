// Form submission handler
document.addEventListener('DOMContentLoaded', function() {
    const bookingForm = document.getElementById('bookingForm');

    // Set minimum date to today
    const dateInput = document.getElementById('date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);

    bookingForm.addEventListener('submit', function(e) {
        e.preventDefault();

        // Get form data
        const formData = {
            name: document.getElementById('name').value,
            phone: document.getElementById('phone').value,
            serviceType: document.getElementById('serviceType').value,
            vehicleType: document.getElementById('vehicleType').value,
            pickupAddress: document.getElementById('pickupAddress').value,
            destination: document.getElementById('destination').value,
            date: document.getElementById('date').value,
            time: document.getElementById('time').value,
            comments: document.getElementById('comments').value
        };

        // Submit to Google Forms
        submitToGoogleForms(formData);
    });
});

// Google Forms submission function
function submitToGoogleForms(data) {
    // IMPORTANT: Replace this URL with your actual Google Form action URL
    // See setup instructions in SETUP_INSTRUCTIONS.txt
    const GOOGLE_FORM_ACTION_URL = 'YOUR_GOOGLE_FORM_ACTION_URL';

    // Replace these entry IDs with your actual Google Form field entry IDs
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

    // Create iframe for form submission
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.name = 'hidden_iframe';
    document.body.appendChild(iframe);

    // Create form element
    const form = document.createElement('form');
    form.target = 'hidden_iframe';
    form.method = 'POST';
    form.action = GOOGLE_FORM_ACTION_URL;

    // Add form parameters
    formParams.forEach((value, key) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
    });

    // Submit form
    document.body.appendChild(form);
    form.submit();

    // Show success message
    showSuccessMessage();

    // Clean up
    setTimeout(() => {
        document.body.removeChild(form);
        document.body.removeChild(iframe);
    }, 1000);
}

// Show success message
function showSuccessMessage() {
    // Create success message element if it doesn't exist
    let successMessage = document.querySelector('.success-message');
    if (!successMessage) {
        successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        const bookingForm = document.getElementById('bookingForm');
        bookingForm.insertBefore(successMessage, bookingForm.firstChild);
    }

    successMessage.innerHTML = '<strong>Booking Request Submitted!</strong><p>Thank you for your booking. We will contact you shortly to confirm your ride.</p>';
    successMessage.classList.add('show');

    // Reset form
    document.getElementById('bookingForm').reset();

    // Hide success message after 5 seconds
    setTimeout(() => {
        successMessage.classList.remove('show');
    }, 5000);

    // Scroll to success message
    successMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// Phone number formatting
document.getElementById('phone').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 10) {
        value = value.slice(0, 10);
    }
    e.target.value = value;
});