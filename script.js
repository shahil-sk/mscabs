/* =============================================
   MS Cabs – script.js
   Leaflet map + Nominatim autocomplete + Price estimator
============================================= */

// ── Nominatim helpers ──────────────────────────────────────────────────────────
const NOM = 'https://nominatim.openstreetmap.org';

async function nominatimSearch(query, limit = 5) {
    const url = `${NOM}/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=${limit}&countrycodes=in&addressdetails=1`;
    const r = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!r.ok) return [];
    return r.json();
}

async function nominatimReverse(lat, lng) {
    const url = `${NOM}/reverse?lat=${lat}&lon=${lng}&format=jsonv2`;
    const r = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!r.ok) throw new Error('reverse failed');
    const d = await r.json();
    return d.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function osmPinUrl(lat, lng) {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}
function osmRouteUrl(pLat, pLng, dLat, dLng) {
    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${pLat},${pLng};${dLat},${dLng}`;
}

// ── Debounce util ─────────────────────────────────────────────────────────────────
function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Pricing config ────────────────────────────────────────────────────────────
// Base rates (₹/km) & minimum fares per vehicle
const PRICE_CONFIG = {
    Sedan:     { perKm: 12,  minFare: 300  },
    SUV:       { perKm: 16,  minFare: 500  },
    Hatchback: { perKm: 10,  minFare: 250  }
};

// Service-type multiplier (outstation adds driver allowance buffer)
const SERVICE_MULTIPLIER = {
    Outstation: 1.15,
    Local:      1.00,
    Airport:    1.10,
    '':         1.00
};

// Road-distance factor: straight-line × 1.3 approximates road distance
const ROAD_FACTOR = 1.3;

// ── Haversine distance (km) ───────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
    const R  = 6371;
    const dL = (lat2 - lat1) * Math.PI / 180;
    const dG = (lng2 - lng1) * Math.PI / 180;
    const a  = Math.sin(dL / 2) ** 2 +
               Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
               Math.sin(dG / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Compute & render price estimate ──────────────────────────────────────────
function updatePriceEstimate() {
    const card = document.getElementById('priceEstimateCard');
    if (!state.pickupCoords || !state.dropCoords) { card.hidden = true; return; }

    const vehicleType  = document.getElementById('vehicleType').value  || 'Sedan';
    const serviceType  = document.getElementById('serviceType').value  || '';
    const cfg          = PRICE_CONFIG[vehicleType] || PRICE_CONFIG.Sedan;
    const multiplier   = SERVICE_MULTIPLIER[serviceType] || 1.00;

    const straightKm   = haversineKm(
        state.pickupCoords.lat, state.pickupCoords.lng,
        state.dropCoords.lat,   state.dropCoords.lng
    );
    const roadKm       = straightKm * ROAD_FACTOR;
    const rawFare      = roadKm * cfg.perKm * multiplier;
    const fare         = Math.max(rawFare, cfg.minFare);

    // Low / high band: ±10%
    const low  = Math.round(fare * 0.9  / 10) * 10;
    const high = Math.round(fare * 1.1  / 10) * 10;

    document.getElementById('priceDistance').textContent  = roadKm.toFixed(1);
    document.getElementById('priceVehicle').textContent   = vehicleType;
    document.getElementById('priceService').textContent   = serviceType || 'Not selected';
    document.getElementById('priceRate').textContent      = `₹${cfg.perKm}/km`;
    document.getElementById('priceLow').textContent       = `₹${low.toLocaleString('en-IN')}`;
    document.getElementById('priceHigh').textContent      = `₹${high.toLocaleString('en-IN')}`;
    card.hidden = false;
}

// ── App state ───────────────────────────────────────────────────────────────────
let map         = null;
let ICON_PICKUP = null;
let ICON_DROP   = null;

const state = {
    pickupMarker: null,
    dropMarker:   null,
    pickupCoords: null,
    dropCoords:   null,
    mode: 'pickup'
};

// ── Build Leaflet icons (must be called after L is available) ─────────────────
function buildIcons() {
    function pin(color, label) {
        return L.divIcon({
            className: '',
            html: `<div class="map-pin" title="${label}">
                     <svg viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
                       <path d="M12 0C7.58 0 4 3.58 4 8c0 6 8 16 8 16s8-10 8-16c0-4.42-3.58-8-8-8z"
                             fill="${color}" stroke="#fff" stroke-width="1.2"/>
                       <circle cx="12" cy="8" r="3" fill="#fff"/>
                     </svg>
                   </div>`,
            iconSize:    [28, 38],
            iconAnchor:  [14, 38],
            popupAnchor: [0, -40]
        });
    }
    ICON_PICKUP = pin('#22c55e', 'Pickup');
    ICON_DROP   = pin('#ef4444', 'Drop');
}

// ── Map init ────────────────────────────────────────────────────────────────
function initMap() {
    if (typeof L === 'undefined') {
        const el = document.getElementById('map');
        if (el) el.innerHTML = '<p style="padding:20px;text-align:center;color:#666">Map could not load. Please check your internet connection and reload.</p>';
        return;
    }

    buildIcons();

    map = L.map('map', { scrollWheelZoom: false })
           .setView([12.2958, 76.6394], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(map);

    map.on('focus', () => map.scrollWheelZoom.enable());
    map.on('blur',  () => map.scrollWheelZoom.disable());

    requestAnimationFrame(() => map.invalidateSize());

    map.on('click', async (e) => {
        if (state.mode === 'pickup') await setPickupCoords(e.latlng.lat, e.latlng.lng, true);
        else                         await setDropCoords(e.latlng.lat,   e.latlng.lng, true);
    });
}

// ── Place / move Pickup marker ─────────────────────────────────────────────────
async function setPickupCoords(lat, lng, doReverse) {
    state.pickupCoords = { lat, lng };
    if (state.pickupMarker) {
        state.pickupMarker.setLatLng([lat, lng]);
    } else {
        state.pickupMarker = L.marker([lat, lng], { icon: ICON_PICKUP, draggable: true })
            .addTo(map).bindPopup('<strong>&#x1F7E2; Pickup</strong>');
        state.pickupMarker.on('dragend', async () => {
            const p = state.pickupMarker.getLatLng();
            await setPickupCoords(p.lat, p.lng, true);
        });
    }
    state.pickupMarker.openPopup();
    if (doReverse) {
        setCoordBadge('pickup', lat, lng, 'Locating…');
        try {
            const addr = await nominatimReverse(lat, lng);
            document.getElementById('pickupAddress').value = addr;
            hideSuggestions('pickup');
            setCoordBadge('pickup', lat, lng, addr.split(',').slice(0, 3).join(','));
        } catch { setCoordBadge('pickup', lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`); }
    }
    updateHiddenFields();
    updateRouteLink();
    updatePriceEstimate();
    map.panTo([lat, lng]);
}

// ── Place / move Drop marker ──────────────────────────────────────────────────
async function setDropCoords(lat, lng, doReverse) {
    state.dropCoords = { lat, lng };
    if (state.dropMarker) {
        state.dropMarker.setLatLng([lat, lng]);
    } else {
        state.dropMarker = L.marker([lat, lng], { icon: ICON_DROP, draggable: true })
            .addTo(map).bindPopup('<strong>&#x1F534; Drop</strong>');
        state.dropMarker.on('dragend', async () => {
            const p = state.dropMarker.getLatLng();
            await setDropCoords(p.lat, p.lng, true);
        });
    }
    state.dropMarker.openPopup();
    if (doReverse) {
        setCoordBadge('drop', lat, lng, 'Locating…');
        try {
            const addr = await nominatimReverse(lat, lng);
            document.getElementById('destination').value = addr;
            hideSuggestions('drop');
            setCoordBadge('drop', lat, lng, addr.split(',').slice(0, 3).join(','));
        } catch { setCoordBadge('drop', lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`); }
    }
    updateHiddenFields();
    updateRouteLink();
    updatePriceEstimate();
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

// ── Hidden fields + route link ─────────────────────────────────────────────────────
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
        if (map) map.fitBounds([
            [state.pickupCoords.lat, state.pickupCoords.lng],
            [state.dropCoords.lat,   state.dropCoords.lng]
        ], { padding: [40, 40] });
    } else {
        row.hidden = true;
    }
}

// ── Autocomplete suggestions ─────────────────────────────────────────────────────
let activeIndex = { pickup: -1, drop: -1 };

function showSuggestions(type, results) {
    const list = document.getElementById(`${type}Suggestions`);
    if (!results.length) { hideSuggestions(type); return; }
    activeIndex[type] = -1;
    list.innerHTML = '';
    results.forEach((item, i) => {
        const li = document.createElement('li');
        li.className = 'suggestion-item';
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.dataset.index = i;
        const name = item.namedetails && item.namedetails.name
            ? item.namedetails.name
            : item.display_name.split(',')[0];
        li.innerHTML = `<span class="sug-icon"><i class="fa-solid fa-location-dot"></i></span>
                        <span class="sug-text">
                          <strong>${name}</strong>
                          <small>${item.display_name.split(',').slice(1, 4).join(',').trim()}</small>
                        </span>`;
        li.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectSuggestion(type, item);
        });
        list.appendChild(li);
    });
    list.hidden = false;
}

function hideSuggestions(type) {
    const list = document.getElementById(`${type}Suggestions`);
    list.hidden = true;
    list.innerHTML = '';
    activeIndex[type] = -1;
}

function highlightItem(type, index) {
    const list  = document.getElementById(`${type}Suggestions`);
    const items = list.querySelectorAll('.suggestion-item');
    items.forEach((el, i) => {
        el.classList.toggle('active', i === index);
        el.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
}

async function selectSuggestion(type, item) {
    const lat  = parseFloat(item.lat);
    const lng  = parseFloat(item.lon);
    const addr = item.display_name;
    if (type === 'pickup') {
        document.getElementById('pickupAddress').value = addr;
        hideSuggestions('pickup');
        if (map) await setPickupCoords(lat, lng, false);
        setCoordBadge('pickup', lat, lng, addr.split(',').slice(0, 3).join(','));
    } else {
        document.getElementById('destination').value = addr;
        hideSuggestions('drop');
        if (map) await setDropCoords(lat, lng, false);
        setCoordBadge('drop', lat, lng, addr.split(',').slice(0, 3).join(','));
    }
    updateHiddenFields();
    updatePriceEstimate();
}

function setupAutocomplete(type, inputId) {
    const input = document.getElementById(inputId);

    const fetchSuggestions = debounce(async (q) => {
        if (q.length < 3) { hideSuggestions(type); return; }
        const results = await nominatimSearch(q, 6);
        showSuggestions(type, results);
    }, 350);

    input.addEventListener('input', () => fetchSuggestions(input.value.trim()));

    input.addEventListener('keydown', (e) => {
        const list  = document.getElementById(`${type}Suggestions`);
        const items = list.querySelectorAll('.suggestion-item');
        if (list.hidden || !items.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex[type] = Math.min(activeIndex[type] + 1, items.length - 1);
            highlightItem(type, activeIndex[type]);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex[type] = Math.max(activeIndex[type] - 1, 0);
            highlightItem(type, activeIndex[type]);
        } else if (e.key === 'Enter') {
            if (activeIndex[type] >= 0) {
                e.preventDefault();
                items[activeIndex[type]].dispatchEvent(new MouseEvent('mousedown'));
            }
        } else if (e.key === 'Escape') {
            hideSuggestions(type);
        }
    });

    input.addEventListener('blur', () => setTimeout(() => hideSuggestions(type), 150));
}

// ── Button loading ────────────────────────────────────────────────────────────────
function btnLoading(btn, on) {
    btn.disabled = on;
    btn.style.opacity = on ? '0.55' : '1';
}

// ── DOMContentLoaded ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    document.getElementById('date').setAttribute('min', new Date().toISOString().split('T')[0]);

    initMap();
    setupAutocomplete('pickup', 'pickupAddress');
    setupAutocomplete('drop',   'destination');

    // Re-calculate when vehicle or service type changes
    document.getElementById('vehicleType').addEventListener('change', updatePriceEstimate);
    document.getElementById('serviceType').addEventListener('change', updatePriceEstimate);

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

    // GPS: My Location
    document.getElementById('useMyLocation').addEventListener('click', function () {
        if (!navigator.geolocation) { alert('Geolocation not supported by your browser.'); return; }
        const btn = this;
        btnLoading(btn, true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                await setPickupCoords(pos.coords.latitude, pos.coords.longitude, true);
                setMode('drop');
                btnLoading(btn, false);
            },
            () => { alert('Location access denied.'); btnLoading(btn, false); },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });

    // Mobile nav
    const navToggle = document.getElementById('navToggle');
    const navLinks  = document.getElementById('navLinks');
    navToggle.addEventListener('click', () => {
        const open = navLinks.classList.toggle('open');
        navToggle.setAttribute('aria-expanded', String(open));
        navToggle.querySelector('i').className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    });
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.querySelector('i').className = 'fa-solid fa-bars';
    }));

    // Phone digits only
    document.getElementById('phone').addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 10);
    });

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - 80, behavior: 'smooth' });
            if (map) setTimeout(() => map.invalidateSize(), 400);
        });
    });

    // Form submit
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
    const GOOGLE_FORM_ACTION_URL =
      'https://docs.google.com/forms/d/e/1FAIpQLSctSNxP_rtf4ab-QL6UDzbGkvdDyeSFC4pqyh8w3jvsCRlz2g/formResponse';

    const extras =
      `PickupLat: ${data.pickupLat}, PickupLng: ${data.pickupLng}\n` +
      `DropLat: ${data.dropLat}, DropLng: ${data.dropLng}\n` +
      `PickupMap: ${data.pickupMapUrl}\n` +
      `DropMap: ${data.dropMapUrl}\n` +
      `RouteMap: ${data.routeMapUrl}`;

    const params = new URLSearchParams({
      // Name
      'entry.1731902692': data.name,
      // Phone
      'entry.970216848': data.phone,
      // Service type
      'entry.1336383824': data.serviceType,
      // Vehicle type
      'entry.1115489851': data.vehicleType,
      // Pickup address
      'entry.1385388401': data.pickupAddress,
      // Drop address
      'entry.827208412': data.destination,
      // Date (you can format if you prefer dd/MM)
      'entry.2102662793': data.date,
      // Time
      'entry.506366157': data.time,
      // Comments
      'entry.1841962630': data.comments,
      // Pickup lat
      'entry.1173550631': data.pickupLat,
      // Pickup lng
      'entry.1785285242': data.pickupLng,
      // Everything else (drop coords + URLs)
      'entry.425635662': extras
    });

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.name = 'hf';

    const form = document.createElement('form');
    form.target = 'hf';
    form.method = 'POST';
    form.action = GOOGLE_FORM_ACTION_URL;

    params.forEach((v, k) => {
      const i = document.createElement('input');
      i.type = 'hidden';
      i.name = k;
      i.value = v;
      form.appendChild(i);
    });

    document.body.appendChild(iframe);
    document.body.appendChild(form);
    form.submit();

    showSuccessMessage();

    setTimeout(() => {
      document.body.removeChild(form);
      document.body.removeChild(iframe);
    }, 1500);
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