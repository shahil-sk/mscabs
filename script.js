/* =============================================
   MS Cabs – script.js
   Booking form + Leaflet map (pickup/drop)
============================================= */

// ── Geocoding helpers (Nominatim) ──────────────────────────────────────────
const NOM_SEARCH  = 'https://nominatim.openstreetmap.org/search';
const NOM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';
const NOM_HEADERS = { 'Accept-Language': 'en', 'User-Agent': 'MSCabs-BookingApp/1.0' };

async function geocodeAddress(query) {
    const url = `${NOM_SEARCH}?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&countrycodes=in`;
    const res = await fetch(url, { headers: NOM_HEADERS });
    if (!res.ok) throw new Error('Geocoding failed');
    const data = await res.json();
    if (!data.length) throw new Error('Address not found');
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
}

async function reverseGeocode(lat, lng) {
    const url = `${NOM_REVERSE}?lat=${lat}&lon=${lng}&format=jsonv2`;
    const res = await fetch(url, { headers: NOM_HEADERS });
    if (!res.ok) throw new Error('Reverse geocoding failed');
    const data = await res.json();
    return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function osmPinUrl(lat, lng) {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}

function osmRouteUrl(pLat, pLng, dLat, dLng) {
    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${pLat},${pLng};${dLat},${dLng}`;
}

// ── Marker icons ───────────────────────────────────────────────────────────
function makeIcon(color) {
    return L.divIcon({
        className: '',
        html: `<div class="map-marker" style="background:${color}"><i class="fa-solid fa-location-dot"></i></div>`,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
        popupAnchor: [0, -42]
    });
}

const ICON_PICKUP = makeIcon('#22c55e');
const ICON_DROP   = makeIcon('#ef4444');

// ── State ──────────────────────────────────────────────────────────────────
const state = {
    pickupMarker: null,
    dropMarker:   null,
    pickupCoords: null,
    dropCoords:   null,
    mode: 'pickup'   // 'pickup' | 'drop'
};

// ── Map init ───────────────────────────────────────────────────────────────
let map;

function initMap() {
    map = L.map('map', { zoomControl: true }).setView([12.2958, 76.6394], 12); // Mysore

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
    }).addTo(map);

    map.on('click', async function (e) {
        const { lat, lng } = e.latlng;
        if (state.mode === 'pickup') {
            await setPickupCoords(lat, lng, true);
        } else {
            await setDropCoords(lat, lng, true);
        }
    });
}

// ── Set pickup by coordinates ──────────────────────────────────────────────
async function setPickupCoords(lat, lng, reverseAddr) {
    state.pickupCoords = { lat, lng };

    if (state.pickupMarker) {
        state.pickupMarker.setLatLng([lat, lng]);
    } else {
        state.pickupMarker = L.marker([lat, lng], { icon: ICON_PICKUP, draggable: true })
            .addTo(map)
            .bindPopup('<b>Pickup</b>');
        state.pickupMarker.on('dragend', async function () {
            const p = state.pickupMarker.getLatLng();
            await setPickupCoords(p.lat, p.lng, true);
        });
    }
    state.pickupMarker.openPopup();

    if (reverseAddr) {
        setCoordBadge('pickup', lat, lng, 'Resolving address...');
        try {
            const addr = await reverseGeocode(lat, lng);
            document.getElementById('pickupAddress').value = addr;
            setCoordBadge('pickup', lat, lng, addr.split(',').slice(0, 3).join(','));
        } catch { setCoordBadge('pickup', lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`); }
    }

    updateHiddenFields();
    updateRouteLink();
    map.panTo([lat, lng]);
}

// ── Set drop by coordinates ────────────────────────────────────────────────
async function setDropCoords(lat, lng, reverseAddr) {
    state.dropCoords = { lat, lng };

    if (state.dropMarker) {
        state.dropMarker.setLatLng([lat, lng]);
    } else {
        state.dropMarker = L.marker([lat, lng], { icon: ICON_DROP, draggable: true })
            .addTo(map)
            .bindPopup('<b>Drop</b>');
        state.dropMarker.on('dragend', async function () {
            const p = state.dropMarker.getLatLng();
            await setDropCoords(p.lat, p.lng, true);
        });
    }
    state.dropMarker.openPopup();

    if (reverseAddr) {
        setCoordBadge('drop', lat, lng, 'Resolving address...');
        try {
            const addr = await reverseGeocode(lat, lng);
            document.getElementById('destination').value = addr;
            setCoordBadge('drop', lat, lng, addr.split(',').slice(0, 3).join(','));
        } catch { setCoordBadge('drop', lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`); }
    }

    updateHiddenFields();
    updateRouteLink();
    map.panTo([lat, lng]);
}

// ── Coordinate badge UI ────────────────────────────────────────────────────
function setCoordBadge(type, lat, lng, label) {
    const badge   = document.getElementById(`${type}CoordBadge`);
    const text    = document.getElementById(`${type}CoordText`);
    const link    = document.getElementById(`${type}MapLink`);
    badge.hidden  = false;
    text.textContent = `${label} (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
    link.href = osmPinUrl(lat, lng);
}

// ── Hidden fields & route link ─────────────────────────────────────────────
function updateHiddenFields() {
    if (state.pickupCoords) {
        document.getElementById('pickupLat').value = state.pickupCoords.lat.toFixed(7);
        document.getElementById('pickupLng').value = state.pickupCoords.lng.toFixed(7);
        document.getElementById('pickupMapUrl').value = osmPinUrl(state.pickupCoords.lat, state.pickupCoords.lng);
    }
    if (state.dropCoords) {
        document.getElementById('dropLat').value = state.dropCoords.lat.toFixed(7);
        document.getElementById('dropLng').value = state.dropCoords.lng.toFixed(7);
        document.getElementById('dropMapUrl').value = osmPinUrl(state.dropCoords.lat, state.dropCoords.lng);
    }
}

function updateRouteLink() {
    const row = document.getElementById('routeLinkRow');
    const link = document.getElementById('routeLink');
    if (state.pickupCoords && state.dropCoords) {
        const url = osmRouteUrl(
            state.pickupCoords.lat, state.pickupCoords.lng,
            state.dropCoords.lat,   state.dropCoords.lng
        );
        document.getElementById('routeMapUrl').value = url;
        link.href = url;
        row.hidden = false;

        // Fit both markers in view
        map.fitBounds([
            [state.pickupCoords.lat, state.pickupCoords.lng],
            [state.dropCoords.lat,   state.dropCoords.lng]
        ], { padding: [40, 40] });
    } else {
        row.hidden = true;
    }
}

// ── Spinner helper ─────────────────────────────────────────────────────────
function btnLoading(btn, yes) {
    btn.disabled = yes;
    btn.style.opacity = yes ? '0.6' : '1';
}

// ── DOMContentLoaded ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {

    // Min date
    const dateInput = document.getElementById('date');
    dateInput.setAttribute('min', new Date().toISOString().split('T')[0]);

    // Init map
    initMap();

    // Map mode toggle
    const modePickupBtn = document.getElementById('modePickup');
    const modeDropBtn   = document.getElementById('modeDrop');
    const mapHint       = document.getElementById('mapHint');

    function setMode(mode) {
        state.mode = mode;
        modePickupBtn.classList.toggle('active', mode === 'pickup');
        modeDropBtn.classList.toggle('active',   mode === 'drop');
        mapHint.innerHTML = mode === 'pickup'
            ? 'Click on the map to set <strong>Pickup</strong> location'
            : 'Click on the map to set <strong>Drop</strong> location';
    }

    modePickupBtn.addEventListener('click', () => setMode('pickup'));
    modeDropBtn.addEventListener('click',   () => setMode('drop'));

    // Search pickup
    document.getElementById('searchPickup').addEventListener('click', async function () {
        const q = document.getElementById('pickupAddress').value.trim();
        if (!q) { alert('Enter a pickup address to search.'); return; }
        btnLoading(this, true);
        try {
            const r = await geocodeAddress(q);
            document.getElementById('pickupAddress').value = r.display;
            await setPickupCoords(r.lat, r.lng, false);
            setCoordBadge('pickup', r.lat, r.lng, r.display.split(',').slice(0, 3).join(','));
        } catch (e) { alert('Could not find address. Try a more specific query.'); }
        btnLoading(this, false);
    });

    // Search drop
    document.getElementById('searchDrop').addEventListener('click', async function () {
        const q = document.getElementById('destination').value.trim();
        if (!q) { alert('Enter a drop address to search.'); return; }
        btnLoading(this, true);
        try {
            const r = await geocodeAddress(q);
            document.getElementById('destination').value = r.display;
            await setDropCoords(r.lat, r.lng, false);
            setCoordBadge('drop', r.lat, r.lng, r.display.split(',').slice(0, 3).join(','));
        } catch (e) { alert('Could not find address. Try a more specific query.'); }
        btnLoading(this, false);
    });

    // Use my location (pickup)
    document.getElementById('useMyLocation').addEventListener('click', function () {
        if (!navigator.geolocation) { alert('Geolocation is not supported by your browser.'); return; }
        btnLoading(this, true);
        const btn = this;
        navigator.geolocation.getCurrentPosition(
            async function (pos) {
                const { latitude: lat, longitude: lng } = pos.coords;
                await setPickupCoords(lat, lng, true);
                setMode('drop'); // auto-switch to drop after GPS pickup
                btnLoading(btn, false);
            },
            function () {
                alert('Location access denied or unavailable.');
                btnLoading(btn, false);
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    });

    // Mobile nav toggle
    const navToggle = document.getElementById('navToggle');
    const navLinks  = document.getElementById('navLinks');
    navToggle.addEventListener('click', function () {
        const open = navLinks.classList.toggle('open');
        navToggle.setAttribute('aria-expanded', open);
        navToggle.querySelector('i').className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    });
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('open');
            navToggle.setAttribute('aria-expanded', 'false');
            navToggle.querySelector('i').className = 'fa-solid fa-bars';
        });
    });

    // Phone digits only
    document.getElementById('phone').addEventListener('input', function (e) {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
    });

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - 80, behavior: 'smooth' });
            }
        });
    });

    // Form submit
    document.getElementById('bookingForm').addEventListener('submit', function (e) {
        e.preventDefault();
        if (!this.checkValidity()) { this.reportValidity(); return; }
        const data = {
            name:           document.getElementById('name').value.trim(),
            phone:          document.getElementById('phone').value.trim(),
            serviceType:    document.getElementById('serviceType').value,
            vehicleType:    document.getElementById('vehicleType').value,
            pickupAddress:  document.getElementById('pickupAddress').value.trim(),
            destination:    document.getElementById('destination').value.trim(),
            date:           document.getElementById('date').value,
            time:           document.getElementById('time').value,
            comments:       document.getElementById('comments').value.trim(),
            pickupLat:      document.getElementById('pickupLat').value,
            pickupLng:      document.getElementById('pickupLng').value,
            dropLat:        document.getElementById('dropLat').value,
            dropLng:        document.getElementById('dropLng').value,
            pickupMapUrl:   document.getElementById('pickupMapUrl').value,
            dropMapUrl:     document.getElementById('dropMapUrl').value,
            routeMapUrl:    document.getElementById('routeMapUrl').value
        };
        submitToGoogleForms(data);
    });
});

// ── Google Forms submission ────────────────────────────────────────────────
function submitToGoogleForms(data) {
    // Replace with your actual Google Form action URL & entry IDs
    const GOOGLE_FORM_ACTION_URL = 'YOUR_GOOGLE_FORM_ACTION_URL';

    const formParams = new URLSearchParams({
        'entry.NAME_ENTRY_ID':         data.name,
        'entry.PHONE_ENTRY_ID':        data.phone,
        'entry.SERVICE_ENTRY_ID':      data.serviceType,
        'entry.VEHICLE_ENTRY_ID':      data.vehicleType,
        'entry.PICKUP_ENTRY_ID':       data.pickupAddress,
        'entry.DESTINATION_ENTRY_ID':  data.destination,
        'entry.DATE_ENTRY_ID':         data.date,
        'entry.TIME_ENTRY_ID':         data.time,
        'entry.COMMENTS_ENTRY_ID':     data.comments,
        // ── NEW: precise location fields ──
        'entry.PICKUP_LAT_ENTRY_ID':   data.pickupLat,
        'entry.PICKUP_LNG_ENTRY_ID':   data.pickupLng,
        'entry.DROP_LAT_ENTRY_ID':     data.dropLat,
        'entry.DROP_LNG_ENTRY_ID':     data.dropLng,
        'entry.PICKUP_MAP_ENTRY_ID':   data.pickupMapUrl,
        'entry.DROP_MAP_ENTRY_ID':     data.dropMapUrl,
        'entry.ROUTE_MAP_ENTRY_ID':    data.routeMapUrl
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

// ── Success message ────────────────────────────────────────────────────────
function showSuccessMessage() {
    let msg = document.querySelector('.success-message');
    if (!msg) {
        msg = document.createElement('div');
        msg.className = 'success-message';
        const f = document.getElementById('bookingForm');
        f.insertBefore(msg, f.firstChild);
    }
    msg.innerHTML = '<strong>&#10003; Booking Request Submitted!</strong><p>Thank you! We will call you shortly to confirm your ride.</p>';
    msg.classList.add('show');
    document.getElementById('bookingForm').reset();
    msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => msg.classList.remove('show'), 6000);
}