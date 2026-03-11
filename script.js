/* =============================================
   MS Cabs – script.js
   Booking form + Leaflet map (pickup/drop)
============================================= */

// ── Nominatim helpers ─────────────────────────────────────────────────────────────
const NOM_SEARCH  = 'https://nominatim.openstreetmap.org/search';
const NOM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

async function geocodeAddress(query) {
    const url = `${NOM_SEARCH}?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&countrycodes=in`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) throw new Error('Geocoding failed');
    const data = await res.json();
    if (!data.length) throw new Error('Address not found');
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
}

async function reverseGeocode(lat, lng) {
    const url = `${NOM_REVERSE}?lat=${lat}&lon=${lng}&format=jsonv2`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
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

// ── App state ───────────────────────────────────────────────────────────────────
let map = null;
let ICON_PICKUP = null;
let ICON_DROP   = null;

const state = {
    pickupMarker: null,
    dropMarker:   null,
    pickupCoords: null,
    dropCoords:   null,
    mode: 'pickup'
};

// ── Create icons (only after Leaflet loaded) ─────────────────────────────────
function buildIcons() {
    function makeIcon(color, label) {
        return L.divIcon({
            className: '',
            html: `<div class="map-pin" style="--pin-color:${color}" title="${label}">
                     <svg viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
                       <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
                     </svg>
                   </div>`,
            iconSize:    [32, 42],
            iconAnchor:  [16, 42],
            popupAnchor: [0, -44]
        });
    }
    ICON_PICKUP = makeIcon('#22c55e', 'Pickup');
    ICON_DROP   = makeIcon('#ef4444', 'Drop');
}

// ── Map init ─────────────────────────────────────────────────────────────────
function initMap() {
    // Guard: if Leaflet not loaded skip gracefully
    if (typeof L === 'undefined') {
        console.warn('Leaflet not loaded – map disabled');
        const mapEl = document.getElementById('map');
        if (mapEl) mapEl.innerHTML = '<p style="padding:20px;text-align:center;color:#666">Map unavailable – please reload the page.</p>';
        return;
    }

    buildIcons(); // safe to call now that L exists

    map = L.map('map', {
        zoomControl:       true,
        scrollWheelZoom:   false   // don't hijack page scroll
    }).setView([12.2958, 76.6394], 12); // Mysore centre

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom:     19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Enable scroll zoom only when user clicks into map
    map.on('focus', () => map.scrollWheelZoom.enable());
    map.on('blur',  () => map.scrollWheelZoom.disable());

    // Re-render tiles once container is fully visible
    setTimeout(() => map.invalidateSize(), 300);

    map.on('click', async function (e) {
        if (state.mode === 'pickup') {
            await setPickupCoords(e.latlng.lat, e.latlng.lng, true);
        } else {
            await setDropCoords(e.latlng.lat, e.latlng.lng, true);
        }
    });
}

// ── Place / move Pickup marker ─────────────────────────────────────────────────
async function setPickupCoords(lat, lng, reverseAddr) {
    state.pickupCoords = { lat, lng };

    if (state.pickupMarker) {
        state.pickupMarker.setLatLng([lat, lng]);
    } else {
        state.pickupMarker = L.marker([lat, lng], { icon: ICON_PICKUP, draggable: true })
            .addTo(map).bindPopup('<strong>🟢 Pickup</strong>');
        state.pickupMarker.on('dragend', async () => {
            const p = state.pickupMarker.getLatLng();
            await setPickupCoords(p.lat, p.lng, true);
        });
    }
    state.pickupMarker.openPopup();

    if (reverseAddr) {
        setCoordBadge('pickup', lat, lng, 'Resolving…');
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

// ── Place / move Drop marker ───────────────────────────────────────────────────
async function setDropCoords(lat, lng, reverseAddr) {
    state.dropCoords = { lat, lng };

    if (state.dropMarker) {
        state.dropMarker.setLatLng([lat, lng]);
    } else {
        state.dropMarker = L.marker([lat, lng], { icon: ICON_DROP, draggable: true })
            .addTo(map).bindPopup('<strong>🔴 Drop</strong>');
        state.dropMarker.on('dragend', async () => {
            const p = state.dropMarker.getLatLng();
            await setDropCoords(p.lat, p.lng, true);
        });
    }
    state.dropMarker.openPopup();

    if (reverseAddr) {
        setCoordBadge('drop', lat, lng, 'Resolving…');
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

// ── Coord badge ────────────────────────────────────────────────────────────────────
function setCoordBadge(type, lat, lng, label) {
    const badge  = document.getElementById(`${type}CoordBadge`);
    const text   = document.getElementById(`${type}CoordText`);
    const link   = document.getElementById(`${type}MapLink`);
    badge.hidden = false;
    text.textContent = `${label} (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
    link.href = osmPinUrl(lat, lng);
}

// ── Sync hidden fields ──────────────────────────────────────────────────────────────
function updateHiddenFields() {
    if (state.pickupCoords) {
        document.getElementById('pickupLat').value    = state.pickupCoords.lat.toFixed(7);
        document.getElementById('pickupLng').value    = state.pickupCoords.lng.toFixed(7);
        document.getElementById('pickupMapUrl').value = osmPinUrl(state.pickupCoords.lat, state.pickupCoords.lng);
    }
    if (state.dropCoords) {
        document.getElementById('dropLat').value    = state.dropCoords.lat.toFixed(7);
        document.getElementById('dropLng').value    = state.dropCoords.lng.toFixed(7);
        document.getElementById('dropMapUrl').value = osmPinUrl(state.dropCoords.lat, state.dropCoords.lng);
    }
}

function updateRouteLink() {
    const row  = document.getElementById('routeLinkRow');
    const link = document.getElementById('routeLink');
    if (state.pickupCoords && state.dropCoords) {
        const url = osmRouteUrl(
            state.pickupCoords.lat, state.pickupCoords.lng,
            state.dropCoords.lat,   state.dropCoords.lng
        );
        document.getElementById('routeMapUrl').value = url;
        link.href  = url;
        row.hidden = false;
        map.fitBounds([
            [state.pickupCoords.lat, state.pickupCoords.lng],
            [state.dropCoords.lat,   state.dropCoords.lng]
        ], { padding: [40, 40] });
    } else {
        row.hidden = true;
    }
}

// ── Button loading state ──────────────────────────────────────────────────────────
function btnLoading(btn, on) {
    btn.disabled      = on;
    btn.style.opacity = on ? '0.55' : '1';
}

// ── DOMContentLoaded ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {

    // Minimum booking date = today
    document.getElementById('date').setAttribute('min', new Date().toISOString().split('T')[0]);

    // ─ Init map ────────────────────────────────────────────────────────────
    initMap();

    // ─ Map mode toggle (Set Pickup / Set Drop) ─────────────────────────────
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

    // ─ Search Pickup address ──────────────────────────────────────────────
    document.getElementById('searchPickup').addEventListener('click', async function () {
        const q = document.getElementById('pickupAddress').value.trim();
        if (!q) { alert('Please enter a pickup address first.'); return; }
        btnLoading(this, true);
        try {
            const r = await geocodeAddress(q);
            document.getElementById('pickupAddress').value = r.display;
            await setPickupCoords(r.lat, r.lng, false);
            setCoordBadge('pickup', r.lat, r.lng, r.display.split(',').slice(0, 3).join(','));
            updateHiddenFields();
        } catch { alert('Address not found. Try a more specific query.'); }
        btnLoading(this, false);
    });

    // ─ Search Drop address ────────────────────────────────────────────────
    document.getElementById('searchDrop').addEventListener('click', async function () {
        const q = document.getElementById('destination').value.trim();
        if (!q) { alert('Please enter a drop address first.'); return; }
        btnLoading(this, true);
        try {
            const r = await geocodeAddress(q);
            document.getElementById('destination').value = r.display;
            await setDropCoords(r.lat, r.lng, false);
            setCoordBadge('drop', r.lat, r.lng, r.display.split(',').slice(0, 3).join(','));
            updateHiddenFields();
        } catch { alert('Address not found. Try a more specific query.'); }
        btnLoading(this, false);
    });

    // ─ GPS: Use My Location for pickup ──────────────────────────────────────
    document.getElementById('useMyLocation').addEventListener('click', function () {
        if (!navigator.geolocation) { alert('Geolocation not supported by your browser.'); return; }
        const btn = this;
        btnLoading(btn, true);
        navigator.geolocation.getCurrentPosition(
            async function (pos) {
                await setPickupCoords(pos.coords.latitude, pos.coords.longitude, true);
                setMode('drop');        // auto-switch so user pins drop next
                btnLoading(btn, false);
            },
            function () {
                alert('Location access denied or unavailable. Please allow location and try again.');
                btnLoading(btn, false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });

    // ─ Mobile nav toggle ───────────────────────────────────────────────────
    const navToggle = document.getElementById('navToggle');
    const navLinks  = document.getElementById('navLinks');
    navToggle.addEventListener('click', function () {
        const open = navLinks.classList.toggle('open');
        navToggle.setAttribute('aria-expanded', String(open));
        navToggle.querySelector('i').className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    });
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.querySelector('i').className = 'fa-solid fa-bars';
    }));

    // ─ Phone: digits only, max 10 ────────────────────────────────────────────
    document.getElementById('phone').addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 10);
    });

    // ─ Smooth scroll ────────────────────────────────────────────────────────
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                const top = target.getBoundingClientRect().top + window.pageYOffset - 80;
                window.scrollTo({ top, behavior: 'smooth' });
                // After scroll, tell Leaflet to re-measure its container
                if (map) setTimeout(() => map.invalidateSize(), 400);
            }
        });
    });

    // ─ Form submit ────────────────────────────────────────────────────────────
    document.getElementById('bookingForm').addEventListener('submit', function (e) {
        e.preventDefault();
        if (!this.checkValidity()) { this.reportValidity(); return; }
        submitToGoogleForms({
            name:          document.getElementById('name').value.trim(),
            phone:         document.getElementById('phone').value.trim(),
            serviceType:   document.getElementById('serviceType').value,
            vehicleType:   document.getElementById('vehicleType').value,
            pickupAddress: document.getElementById('pickupAddress').value.trim(),
            destination:   document.getElementById('destination').value.trim(),
            date:          document.getElementById('date').value,
            time:          document.getElementById('time').value,
            comments:      document.getElementById('comments').value.trim(),
            pickupLat:     document.getElementById('pickupLat').value,
            pickupLng:     document.getElementById('pickupLng').value,
            dropLat:       document.getElementById('dropLat').value,
            dropLng:       document.getElementById('dropLng').value,
            pickupMapUrl:  document.getElementById('pickupMapUrl').value,
            dropMapUrl:    document.getElementById('dropMapUrl').value,
            routeMapUrl:   document.getElementById('routeMapUrl').value
        });
    });
});

// ── Google Forms submission ─────────────────────────────────────────────────────
function submitToGoogleForms(data) {
    const GOOGLE_FORM_ACTION_URL = 'YOUR_GOOGLE_FORM_ACTION_URL'; // ← replace
    const params = new URLSearchParams({
        'entry.NAME_ENTRY_ID':        data.name,
        'entry.PHONE_ENTRY_ID':       data.phone,
        'entry.SERVICE_ENTRY_ID':     data.serviceType,
        'entry.VEHICLE_ENTRY_ID':     data.vehicleType,
        'entry.PICKUP_ENTRY_ID':      data.pickupAddress,
        'entry.DESTINATION_ENTRY_ID': data.destination,
        'entry.DATE_ENTRY_ID':        data.date,
        'entry.TIME_ENTRY_ID':        data.time,
        'entry.COMMENTS_ENTRY_ID':    data.comments,
        'entry.PICKUP_LAT_ENTRY_ID':  data.pickupLat,
        'entry.PICKUP_LNG_ENTRY_ID':  data.pickupLng,
        'entry.DROP_LAT_ENTRY_ID':    data.dropLat,
        'entry.DROP_LNG_ENTRY_ID':    data.dropLng,
        'entry.PICKUP_MAP_ENTRY_ID':  data.pickupMapUrl,
        'entry.DROP_MAP_ENTRY_ID':    data.dropMapUrl,
        'entry.ROUTE_MAP_ENTRY_ID':   data.routeMapUrl
    });

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none'; iframe.name = 'hf_iframe';
    const form = document.createElement('form');
    form.target = 'hf_iframe'; form.method = 'POST'; form.action = GOOGLE_FORM_ACTION_URL;
    params.forEach((v, k) => {
        const i = document.createElement('input');
        i.type = 'hidden'; i.name = k; i.value = v; form.appendChild(i);
    });
    document.body.appendChild(iframe);
    document.body.appendChild(form);
    form.submit();
    showSuccessMessage();
    setTimeout(() => { document.body.removeChild(form); document.body.removeChild(iframe); }, 1500);
}

// ── Success toast ──────────────────────────────────────────────────────────────
function showSuccessMessage() {
    let msg = document.querySelector('.success-message');
    if (!msg) {
        msg = document.createElement('div');
        msg.className = 'success-message';
        const f = document.getElementById('bookingForm');
        f.insertBefore(msg, f.firstChild);
    }
    msg.innerHTML = '<strong>&#10003; Booking Submitted!</strong><p>Thank you! We will call you shortly to confirm your ride.</p>';
    msg.classList.add('show');
    document.getElementById('bookingForm').reset();
    msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => msg.classList.remove('show'), 6000);
}