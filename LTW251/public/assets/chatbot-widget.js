(function () {
  var storageKey = 'lowland_chatbot_history_v3';
  var externalSessionStorageKey = 'lowland_external_session_token_v1';
  var widget = document.getElementById('chatbot-widget');
  var toggleBtn = document.getElementById('chatbot-toggle');
  var closeBtn = document.getElementById('chatbot-close');
  var panel = document.getElementById('chatbot-panel');
  var form = document.getElementById('chatbot-form');
  var input = document.getElementById('chatbot-input');
  var messages = document.getElementById('chatbot-messages');
  var quick = document.getElementById('chatbot-quick');
  var submitBtn = form ? form.querySelector('button[type="submit"]') : null;
  var isSending = false;
  var addressApiBase = 'https://provinces.open-api.vn/api';
  var addressDataCache = {
    provinces: null,
    districts: {},
    wards: {}
  };
  if (!widget || !toggleBtn || !panel || !form || !input || !messages || !quick) return;

  var baseUrl = String(widget.dataset.baseUrl || '').trim();
  if (!baseUrl) {
    baseUrl = window.location.origin;
  }
  baseUrl = baseUrl.replace(/\/$/, '');
  var externalSessionToken = bootstrapExternalSessionToken();

  function loadHistory() {
    try {
      var raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(history.slice(-60)));
    } catch (e) { }
  }

  function bootstrapExternalSessionToken() {
    try {
      var token = '';
      var params = new URLSearchParams(window.location.search || '');
      var fromUrl = String(params.get('tg_session') || '').trim();
      if (fromUrl) {
        token = fromUrl;
        localStorage.setItem(externalSessionStorageKey, token);
        params.delete('tg_session');
        params.delete('src');
        var cleanQuery = params.toString();
        var cleanUrl = window.location.pathname + (cleanQuery ? ('?' + cleanQuery) : '') + (window.location.hash || '');
        window.history.replaceState({}, document.title, cleanUrl);
      } else {
        token = String(localStorage.getItem(externalSessionStorageKey) || '').trim();
      }
      return token;
    } catch (e) {
      return '';
    }
  }

  function setSending(flag) {
    isSending = !!flag;
    input.disabled = isSending;
    if (submitBtn) submitBtn.disabled = isSending;
  }

  function normalizeSuggestion(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') {
      var label = entry.trim();
      if (!label) return null;
      return { label: label, payload: label };
    }
    var labelObj = String(entry.label || '').trim();
    var payloadObj = String(entry.payload || '').trim();
    if (!labelObj || !payloadObj) return null;
    return { label: labelObj, payload: payloadObj };
  }

  function normalizeSuggestions(raw) {
    if (!Array.isArray(raw)) return [];
    var out = [];
    raw.forEach(function (entry) {
      var normalized = normalizeSuggestion(entry);
      if (normalized) out.push(normalized);
    });
    return out;
  }

  function formatVnd(value) {
    var num = Number(value);
    if (!Number.isFinite(num)) return '';
    return num.toLocaleString('vi-VN') + ' đ';
  }

  function mapCategoryLabel(raw) {
    var key = String(raw || '').toLowerCase();
    if (key === 'coffee') return 'Cà phê';
    if (key === 'milk_tea') return 'Trà sữa';
    if (key === 'fruit_tea') return 'Trà trái cây';
    if (key === 'juice') return 'Nước ép';
    return 'Khác';
  }

  function normalizeImageUrl(raw) {
    var v = String(raw || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    return baseUrl + (v.charAt(0) === '/' ? v : '/' + v);
  }

  function clearQuickChips() {
    quick.innerHTML = '';
  }

  function isOrderReviewPayload(payload) {
    return String(payload || '').indexOf('OPEN_WEB_REVIEW:') === 0;
  }

  function normalizeReviewItemsPayload(rawItems) {
    var parts = String(rawItems || '')
      .split(',')
      .map(function (part) { return part.trim().toUpperCase(); })
      .filter(Boolean);
    if (!parts.length) return '';

    var normalized = [];
    parts.forEach(function (part) {
      if (normalized.length >= 20) return;
      var matched = part.match(/^([A-Z0-9_-]{2,40}):([1-9][0-9]{0,2})$/);
      if (matched) {
        normalized.push(matched[1] + ':' + matched[2]);
      }
    });
    return normalized.join(',');
  }

  function buildOrderReviewUrl(payload) {
    var parsed = parseReviewPayload(payload);
    if (!parsed || !parsed.items) return '';
    var url = baseUrl + '/?r=site/orderReview&items=' + encodeURIComponent(parsed.items) + '&ch=web';
    if (externalSessionToken) {
      url += '&ext=' + encodeURIComponent(externalSessionToken);
    }
    if (parsed.name) {
      url += '&rn=' + encodeURIComponent(parsed.name);
    }
    if (parsed.phone) {
      url += '&rp=' + encodeURIComponent(parsed.phone);
    }
    if (parsed.address) {
      url += '&ra=' + encodeURIComponent(parsed.address);
    }
    if (parsed.payment) {
      url += '&rm=' + encodeURIComponent(parsed.payment);
    }
    return url;
  }

  function parseReviewPayload(payload) {
    var prefix = 'OPEN_WEB_REVIEW:';
    var raw = String(payload || '').trim();
    if (raw.indexOf(prefix) !== 0) return null;
    var body = raw.slice(prefix.length).trim();
    if (!body || body.length > 1200) return null;

    var chunks = body.split('|').map(function (part) { return String(part || '').trim(); }).filter(Boolean);
    if (!chunks.length) return null;

    var items = normalizeReviewItemsPayload(chunks.shift() || '');
    if (!items) return null;

    var parsed = { items: items, name: '', phone: '', address: '', payment: '' };
    chunks.forEach(function (chunk) {
      var idx = chunk.indexOf('=');
      if (idx <= 0) return;
      var key = chunk.slice(0, idx).trim().toLowerCase();
      var value = chunk.slice(idx + 1).trim();
      if (!value) return;

      if (key === 'n') {
        parsed.name = decodeReviewField(value);
        return;
      }
      if (key === 'a') {
        parsed.address = decodeReviewField(value);
        return;
      }
      if (key === 'p') {
        parsed.phone = String(value).replace(/\D+/g, '').slice(0, 15);
        return;
      }
      if (key === 'm') {
        var payment = String(value).toLowerCase();
        if (payment === 'bank_transfer' || payment === 'cod') {
          parsed.payment = payment;
        }
      }
    });

    return parsed;
  }

  function decodeReviewField(encoded) {
    var raw = String(encoded || '').trim();
    if (!raw || !/^[A-Za-z0-9\-_]+$/.test(raw)) return '';
    try {
      var b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4 !== 0) b64 += '=';
      var utf8 = decodeURIComponent(escape(window.atob(b64)));
      return String(utf8 || '').trim();
    } catch (e) {
      return '';
    }
  }

  function setQuickChips(suggestionsRaw) {
    clearQuickChips();
    var suggestions = normalizeSuggestions(suggestionsRaw);
    if (!suggestions.length) return;

    suggestions.slice(0, 5).forEach(function (s) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chatbot-chip';
      chip.textContent = s.label;
      chip.addEventListener('click', function () {
        if (isOrderReviewPayload(s.payload)) {
          var reviewUrl = buildOrderReviewUrl(s.payload);
          if (reviewUrl) {
            window.open(reviewUrl, '_blank', 'noopener');
            return;
          }
        }
        submitUserMessage(s.label, s.payload);
      });
      quick.appendChild(chip);
    });
  }

  function createMenuBlock(ui) {
    if (!ui || ui.type !== 'menu' || !Array.isArray(ui.items) || ui.items.length === 0) {
      return null;
    }

    var block = document.createElement('div');
    block.className = 'chatbot-menu-block';

    if (ui.title) {
      var title = document.createElement('div');
      title.className = 'chatbot-menu-title';
      title.textContent = ui.title;
      block.appendChild(title);
    }

    var list = document.createElement('div');
    list.className = 'chatbot-menu-list';
    ui.items.slice(0, 8).forEach(function (item) {
      var sku = String(item.sku || '').trim();
      if (!sku) return;

      var card = document.createElement('div');
      card.className = 'chatbot-menu-item';

      var imageUrl = normalizeImageUrl(item.imageUrl || item.image || '');
      if (imageUrl) {
        var media = document.createElement('div');
        media.className = 'chatbot-menu-media';
        var img = document.createElement('img');
        img.src = imageUrl;
        img.alt = item.name || 'Ảnh sản phẩm';
        media.appendChild(img);
        card.appendChild(media);
      }

      var head = document.createElement('div');
      head.className = 'chatbot-menu-item-head';
      var name = document.createElement('span');
      name.className = 'chatbot-menu-name';
      name.textContent = (item.name || 'Sản phẩm') + ' (' + sku + ')';
      var price = document.createElement('span');
      price.className = 'chatbot-menu-price';
      price.textContent = formatVnd(item.priceVnd);
      head.appendChild(name);
      head.appendChild(price);
      card.appendChild(head);

      var meta = document.createElement('div');
      meta.className = 'chatbot-menu-meta';
      meta.textContent = 'Nhóm: ' + mapCategoryLabel(item.category) + ' | Còn: ' + (item.stockQty || 0);
      card.appendChild(meta);

      var actions = document.createElement('div');
      actions.className = 'chatbot-menu-actions';

      var detailBtn = document.createElement('button');
      detailBtn.type = 'button';
      detailBtn.className = 'chatbot-mini-btn';
      detailBtn.textContent = 'Chi tiết';
      detailBtn.addEventListener('click', function () {
        submitUserMessage('chi tiet ' + sku, null);
      });

      var orderBtn = document.createElement('button');
      orderBtn.type = 'button';
      orderBtn.className = 'chatbot-mini-btn primary';
      orderBtn.textContent = 'Đặt nhanh';
      orderBtn.addEventListener('click', function () {
        submitUserMessage('Đặt ' + (item.name || sku), 'ACTION_ORDER_ADD:' + sku);
      });

      actions.appendChild(detailBtn);
      actions.appendChild(orderBtn);
      card.appendChild(actions);
      list.appendChild(card);
    });

    block.appendChild(list);
    return block;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseMarkdown(text) {
    var html = escapeHtml(text);
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  function isGoogleMapsUrl(value) {
    var url = String(value || '').trim().toLowerCase();
    if (!url) return false;
    return /^https?:\/\/(?:www\.)?(?:maps\.app\.goo\.gl(?:\/|$)|goo\.gl\/maps(?:\/|$)|maps\.google\.[^\/]+(?:\/|$)|google\.[^\/]+\/maps(?:\/|$|\?)|www\.google\.[^\/]+\/maps(?:\/|$|\?))/.test(url);
  }

  function toLatLng(latRaw, lngRaw) {
    var lat = Number(latRaw);
    var lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
  }

  function extractLatLngFromGoogleMapsUrl(value) {
    var raw = String(value || '').trim();
    if (!raw || !isGoogleMapsUrl(raw)) return null;

    var directAt = raw.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
    if (directAt) {
      return toLatLng(directAt[1], directAt[2]);
    }
    var direct3d4d = raw.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
    if (direct3d4d) {
      return toLatLng(direct3d4d[1], direct3d4d[2]);
    }

    try {
      var parsed = new URL(raw);
      var q = parsed.searchParams.get('q') || parsed.searchParams.get('query') || parsed.searchParams.get('ll') || parsed.searchParams.get('center');
      if (q) {
        var pair = String(q).match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
        if (pair) {
          return toLatLng(pair[1], pair[2]);
        }
      }
      var pathname = decodeURIComponent(parsed.pathname || '');
      var pathAt = pathname.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
      if (pathAt) {
        return toLatLng(pathAt[1], pathAt[2]);
      }
      var pathPair = pathname.match(/\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:,|\/|$)/i);
      if (pathPair) {
        return toLatLng(pathPair[1], pathPair[2]);
      }
    } catch (e) { }

    return null;
  }

  function normalizeAddressToken(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function simplifyAddressToken(value) {
    return normalizeAddressToken(value)
      .replace(/\b(thanh pho|tp|tinh|quan|huyen|thi xa|thi tran|phuong|xa|ward|district|city|province)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findRowByName(rows, target) {
    if (!Array.isArray(rows) || !target) return null;
    var targetRaw = normalizeAddressToken(target);
    var targetSimple = simplifyAddressToken(target);
    var exact = null;
    var fuzzy = null;
    rows.forEach(function (row) {
      var name = String((row && row.name) || '');
      var raw = normalizeAddressToken(name);
      var simple = simplifyAddressToken(name);
      if (!exact && (raw === targetRaw || simple === targetSimple)) {
        exact = row;
      }
      if (!fuzzy && targetSimple && (simple.indexOf(targetSimple) >= 0 || targetSimple.indexOf(simple) >= 0)) {
        fuzzy = row;
      }
    });
    return exact || fuzzy;
  }

  function createAddressPicker(entry) {
    if (!entry || !entry.state || entry.state.name !== 'ORDER_COLLECT_ADDRESS') return null;

    var block = document.createElement('div');
    block.className = 'chatbot-address-helper';

    var title = document.createElement('div');
    title.className = 'chatbot-address-title';
    title.textContent = 'Chọn địa chỉ nhanh';
    block.appendChild(title);

    var hint = document.createElement('div');
    hint.className = 'chatbot-address-hint';
    hint.textContent = 'Bạn có thể dán link Google Maps hoặc chọn khu vực bên dưới.';
    block.appendChild(hint);

    var mapRow = document.createElement('div');
    mapRow.className = 'chatbot-address-map-row';

    var mapInput = document.createElement('input');
    mapInput.type = 'url';
    mapInput.placeholder = 'Link Google Maps (tùy chọn)';
    mapInput.className = 'chatbot-address-input';
    var parseMapBtn = document.createElement('button');
    parseMapBtn.type = 'button';
    parseMapBtn.className = 'chatbot-mini-btn';
    parseMapBtn.textContent = 'Tách link';
    mapRow.appendChild(mapInput);
    mapRow.appendChild(parseMapBtn);
    block.appendChild(mapRow);

    var grid = document.createElement('div');
    grid.className = 'chatbot-address-grid';

    var provinceSelect = document.createElement('select');
    provinceSelect.className = 'chatbot-address-select';
    provinceSelect.innerHTML = '<option value="">Chọn tỉnh/thành phố</option>';

    var districtSelect = document.createElement('select');
    districtSelect.className = 'chatbot-address-select';
    districtSelect.innerHTML = '<option value="">Chọn quận/huyện</option>';
    districtSelect.disabled = true;

    var wardSelect = document.createElement('select');
    wardSelect.className = 'chatbot-address-select';
    wardSelect.innerHTML = '<option value="">Chọn phường/xã</option>';
    wardSelect.disabled = true;

    var detailInput = document.createElement('input');
    detailInput.type = 'text';
    detailInput.placeholder = 'Số nhà, tên đường...';
    detailInput.className = 'chatbot-address-input';

    grid.appendChild(provinceSelect);
    grid.appendChild(districtSelect);
    grid.appendChild(wardSelect);
    grid.appendChild(detailInput);
    block.appendChild(grid);

    var error = document.createElement('div');
    error.className = 'chatbot-address-error';
    block.appendChild(error);
    var status = document.createElement('div');
    status.className = 'chatbot-address-status';
    block.appendChild(status);

    var actions = document.createElement('div');
    actions.className = 'chatbot-address-actions';
    var locateBtn = document.createElement('button');
    locateBtn.type = 'button';
    locateBtn.className = 'chatbot-mini-btn';
    locateBtn.textContent = 'Giao tới vị trí hiện tại';
    var submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'chatbot-mini-btn primary';
    submit.textContent = 'Dùng địa chỉ này';
    actions.appendChild(locateBtn);
    actions.appendChild(submit);
    block.appendChild(actions);

    function renderOptions(selectEl, placeholder, rows) {
      var html = '<option value="">' + placeholder + '</option>';
      rows.forEach(function (row) {
        html += '<option value="' + escapeHtml(String(row.code || '')) + '">' + escapeHtml(String(row.name || '')) + '</option>';
      });
      selectEl.innerHTML = html;
    }

    async function loadProvinces() {
      if (Array.isArray(addressDataCache.provinces)) {
        renderOptions(provinceSelect, 'Chọn tỉnh/thành phố', addressDataCache.provinces);
        return;
      }
      try {
        var resp = await fetch(addressApiBase + '/p/');
        var data = await resp.json();
        addressDataCache.provinces = Array.isArray(data) ? data : [];
        renderOptions(provinceSelect, 'Chọn tỉnh/thành phố', addressDataCache.provinces);
      } catch (e) {
        error.textContent = 'Không tải được danh sách tỉnh/thành. Bạn có thể dán link Google Maps.';
      }
    }

    async function reverseGeocode(lat, lng) {
      var url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=vi&lat=' +
        encodeURIComponent(String(lat)) + '&lon=' + encodeURIComponent(String(lng));
      var resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!resp.ok) {
        throw new Error('reverse_failed');
      }
      var data = await resp.json();
      return (data && typeof data === 'object') ? data : null;
    }

    async function applyAutoFillFromCoords(lat, lng) {
      var geo = null;
      try {
        geo = await reverseGeocode(lat, lng);
      } catch (e) {
        return false;
      }
      if (!geo || !geo.address) {
        return false;
      }

      var addr = geo.address || {};
      var provinceGuess = addr.state || addr.province || addr.city || addr.region || '';
      var districtGuess = addr.city_district || addr.county || addr.district || addr.town || '';
      var wardGuess = addr.ward || addr.suburb || addr.quarter || addr.neighbourhood || addr.village || '';
      var streetGuessParts = [];
      if (addr.house_number) streetGuessParts.push(String(addr.house_number));
      if (addr.road) streetGuessParts.push(String(addr.road));
      if (!streetGuessParts.length && addr.pedestrian) streetGuessParts.push(String(addr.pedestrian));
      if (!streetGuessParts.length && addr.residential) streetGuessParts.push(String(addr.residential));
      var streetGuess = streetGuessParts.join(' ').trim();

      await loadProvinces();
      var provinceRows = Array.isArray(addressDataCache.provinces) ? addressDataCache.provinces : [];
      var province = findRowByName(provinceRows, provinceGuess);
      if (province && province.code) {
        provinceSelect.value = String(province.code);
        var districts = await loadDistricts(province.code);
        renderOptions(districtSelect, 'Chọn quận/huyện', districts);
        districtSelect.disabled = false;

        var district = findRowByName(districts, districtGuess);
        if (district && district.code) {
          districtSelect.value = String(district.code);
          var wards = await loadWards(district.code);
          renderOptions(wardSelect, 'Chọn phường/xã', wards);
          wardSelect.disabled = false;

          var ward = findRowByName(wards, wardGuess);
          if (ward && ward.code) {
            wardSelect.value = String(ward.code);
          }
        }
      }

      if (!detailInput.value.trim()) {
        if (streetGuess) {
          detailInput.value = streetGuess;
        } else if (geo.display_name) {
          detailInput.value = String(geo.display_name).split(',')[0].trim();
        } else {
          detailInput.value = 'Vị trí hiện tại (' + lat + ', ' + lng + ')';
        }
      }
      return true;
    }

    async function analyzeMapLink(raiseErrorOnFail) {
      var mapLink = String(mapInput.value || '').trim();
      if (!mapLink) return false;

      if (!isGoogleMapsUrl(mapLink)) {
        if (raiseErrorOnFail) {
          error.textContent = 'Link Google Maps chưa hợp lệ.';
        }
        return false;
      }

      var coords = extractLatLngFromGoogleMapsUrl(mapLink);
      if (!coords) {
        if (raiseErrorOnFail) {
          error.textContent = 'Link Maps hợp lệ nhưng chưa tách được tọa độ. Bạn chọn khu vực thủ công hoặc dùng vị trí hiện tại.';
        }
        return false;
      }

      status.textContent = 'Đang phân tích link Maps và tự điền khu vực...';
      var autoFilled = await applyAutoFillFromCoords(coords.lat, coords.lng);
      if (autoFilled) {
        status.textContent = 'Đã tự điền tỉnh/quận/phường từ link Maps. Bạn kiểm tra rồi bấm "Dùng địa chỉ này".';
      } else {
        status.textContent = 'Đã đọc tọa độ từ link Maps. Bạn kiểm tra lại khu vực rồi bấm "Dùng địa chỉ này".';
      }
      if (!detailInput.value.trim()) {
        detailInput.value = 'Vị trí bản đồ (' + coords.lat + ', ' + coords.lng + ')';
      }
      return autoFilled;
    }

    async function loadDistricts(provinceCode) {
      if (!provinceCode) return [];
      if (addressDataCache.districts[provinceCode]) return addressDataCache.districts[provinceCode];
      try {
        var resp = await fetch(addressApiBase + '/p/' + encodeURIComponent(provinceCode) + '?depth=2');
        var data = await resp.json();
        var districts = Array.isArray(data && data.districts) ? data.districts : [];
        addressDataCache.districts[provinceCode] = districts;
        return districts;
      } catch (e) {
        return [];
      }
    }

    async function loadWards(districtCode) {
      if (!districtCode) return [];
      if (addressDataCache.wards[districtCode]) return addressDataCache.wards[districtCode];
      try {
        var resp = await fetch(addressApiBase + '/d/' + encodeURIComponent(districtCode) + '?depth=2');
        var data = await resp.json();
        var wards = Array.isArray(data && data.wards) ? data.wards : [];
        addressDataCache.wards[districtCode] = wards;
        return wards;
      } catch (e) {
        return [];
      }
    }

    provinceSelect.addEventListener('change', async function () {
      error.textContent = '';
      districtSelect.disabled = true;
      wardSelect.disabled = true;
      districtSelect.innerHTML = '<option value="">Chọn quận/huyện</option>';
      wardSelect.innerHTML = '<option value="">Chọn phường/xã</option>';
      var code = provinceSelect.value;
      if (!code) return;
      var districts = await loadDistricts(code);
      renderOptions(districtSelect, 'Chọn quận/huyện', districts);
      districtSelect.disabled = false;
    });

    districtSelect.addEventListener('change', async function () {
      error.textContent = '';
      wardSelect.disabled = true;
      wardSelect.innerHTML = '<option value="">Chọn phường/xã</option>';
      var code = districtSelect.value;
      if (!code) return;
      var wards = await loadWards(code);
      renderOptions(wardSelect, 'Chọn phường/xã', wards);
      wardSelect.disabled = false;
    });

    submit.addEventListener('click', function () {
      error.textContent = '';
      status.textContent = '';
      var mapLink = String(mapInput.value || '').trim();
      var detail = String(detailInput.value || '').trim();
      var provinceName = provinceSelect.options[provinceSelect.selectedIndex] ? provinceSelect.options[provinceSelect.selectedIndex].text : '';
      var districtName = districtSelect.options[districtSelect.selectedIndex] ? districtSelect.options[districtSelect.selectedIndex].text : '';
      var wardName = wardSelect.options[wardSelect.selectedIndex] ? wardSelect.options[wardSelect.selectedIndex].text : '';

      if (mapLink && !isGoogleMapsUrl(mapLink)) {
        error.textContent = 'Link Google Maps chưa hợp lệ.';
        return;
      }

      var hasStructuredAddress = provinceSelect.value && districtSelect.value && wardSelect.value && detail;
      if (!mapLink && !hasStructuredAddress) {
        error.textContent = 'Điền địa chỉ chi tiết hoặc dán link Google Maps.';
        return;
      }

      var addressText = '';
      if (hasStructuredAddress) {
        addressText = [detail, wardName, districtName, provinceName].filter(Boolean).join(', ');
      }
      if (mapLink) {
        addressText = addressText ? (addressText + ' | Maps: ' + mapLink) : ('Google Maps: ' + mapLink);
      }

      submitUserMessage(addressText, null);
    });

    parseMapBtn.addEventListener('click', async function () {
      error.textContent = '';
      status.textContent = '';
      parseMapBtn.disabled = true;
      parseMapBtn.textContent = 'Đang tách...';
      try {
        await analyzeMapLink(true);
      } finally {
        parseMapBtn.disabled = false;
        parseMapBtn.textContent = 'Tách link';
      }
    });

    mapInput.addEventListener('change', async function () {
      error.textContent = '';
      status.textContent = '';
      await analyzeMapLink(false);
    });

    locateBtn.addEventListener('click', function () {
      error.textContent = '';
      status.textContent = '';
      if (!navigator.geolocation) {
        error.textContent = 'Trình duyệt không hỗ trợ lấy vị trí.';
        return;
      }
      locateBtn.disabled = true;
      locateBtn.textContent = 'Đang lấy vị trí...';

      navigator.geolocation.getCurrentPosition(async function (position) {
        var lat = Number(position.coords.latitude).toFixed(6);
        var lng = Number(position.coords.longitude).toFixed(6);
        var mapLink = 'https://www.google.com/maps?q=' + lat + ',' + lng;
        mapInput.value = mapLink;
        var autoFilled = await applyAutoFillFromCoords(lat, lng);
        if (!autoFilled && !detailInput.value.trim()) {
          detailInput.value = 'Vị trí hiện tại (' + lat + ', ' + lng + ')';
        }
        status.textContent = autoFilled
          ? 'Đã tự điền tỉnh/quận/phường theo vị trí hiện tại. Bạn kiểm tra rồi bấm "Dùng địa chỉ này".'
          : 'Đã lấy vị trí hiện tại. Bạn kiểm tra địa chỉ rồi bấm "Dùng địa chỉ này".';

        locateBtn.disabled = false;
        locateBtn.textContent = 'Giao tới vị trí hiện tại';
      }, function (geoErr) {
        locateBtn.disabled = false;
        locateBtn.textContent = 'Giao tới vị trí hiện tại';
        if (geoErr && geoErr.code === 1) {
          error.textContent = 'Bạn chưa cấp quyền vị trí. Hãy cho phép truy cập vị trí rồi thử lại.';
          return;
        }
        if (geoErr && geoErr.code === 2) {
          error.textContent = 'Không xác định được vị trí hiện tại.';
          return;
        }
        if (geoErr && geoErr.code === 3) {
          error.textContent = 'Lấy vị trí bị timeout. Bạn thử lại hoặc dán link Google Maps.';
          return;
        }
        error.textContent = 'Không lấy được vị trí hiện tại. Bạn thử lại hoặc dán link Google Maps.';
      }, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000
      });
    });

    loadProvinces();
    return block;
  }

  function addMessage(entry, interactive) {
    if (typeof interactive === 'undefined') interactive = true;
    var role = entry && entry.role === 'user' ? 'user' : 'bot';
    var text = entry && entry.text ? String(entry.text) : '';
    var row = document.createElement('div');
    row.className = 'chatbot-row ' + role;
    var bubble = document.createElement('div');
    bubble.className = 'chatbot-bubble';

    if (entry && entry.isTyping) {
      bubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    } else {
      bubble.innerHTML = parseMarkdown(text);
    }

    row.appendChild(bubble);

    if (role === 'bot') {
      var menuBlock = createMenuBlock(entry && entry.ui ? entry.ui : null);
      if (menuBlock) {
        row.appendChild(menuBlock);
      }
      if (interactive) {
        var addressPicker = createAddressPicker(entry);
        if (addressPicker) {
          row.appendChild(addressPicker);
        }
      }
    }

    messages.appendChild(row);
    messages.scrollTo({
      top: messages.scrollHeight,
      behavior: 'smooth'
    });
    return row;
  }

  function defaultSuggestions() {
    return [
      { label: 'Xem menu', payload: 'ACTION_VIEW_MENU' },
      { label: 'Cà phê', payload: 'ACTION_CATEGORY:coffee' },
      { label: 'Đặt đơn', payload: 'ACTION_ORDER_START' },
      { label: 'Gặp tư vấn viên', payload: 'ACTION_HANDOFF_REQUEST' }
    ];
  }

  function renderHistory() {
    messages.innerHTML = '';
    var history = loadHistory();
    if (history.length === 0) {
      var welcome = {
        role: 'bot',
        text: 'Xin chào, mình là trợ lý đặt nước. Bạn cần tìm món nào?',
        ui: {
          type: 'menu',
          suggestions: defaultSuggestions()
        }
      };
      addMessage(welcome, false);
      saveHistory([welcome]);
      setQuickChips(welcome.ui.suggestions);
      return;
    }

    history.forEach(function (m) {
      addMessage(m, false);
    });

    var lastBot = null;
    for (var i = history.length - 1; i >= 0; i--) {
      if (history[i] && history[i].role === 'bot') {
        lastBot = history[i];
        break;
      }
    }
    var suggestions = lastBot && lastBot.ui ? lastBot.ui.suggestions : defaultSuggestions();
    setQuickChips(suggestions);
  }

  async function sendMessage(payload) {
    var body = {
      message: String(payload.message || '').trim()
    };
    if (payload.actionPayload) {
      body.actionPayload = String(payload.actionPayload).trim();
    }
    if (externalSessionToken) {
      body.externalSessionToken = externalSessionToken;
    }

    var resp = await fetch(baseUrl + '/?r=site/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    var data = await resp.json();
    if (!resp.ok || !data.ok || !data.data || !data.data.reply) {
      throw new Error((data && data.error) || 'Lỗi hệ thống');
    }
    return data.data;
  }

  async function submitUserMessage(rawText, actionPayload) {
    var displayText = String(rawText || '').trim();
    var payload = actionPayload ? String(actionPayload).trim() : '';
    if ((!displayText && !payload) || isSending) return;

    input.value = '';
    var history = loadHistory();
    var userEntry = {
      role: 'user',
      text: displayText || '...' 
    };
    history.push(userEntry);
    saveHistory(history);
    addMessage(userEntry, false);

    var loadingEntry = { role: 'bot', text: '', isTyping: true };
    var loadingNode = addMessage(loadingEntry, false);
    setSending(true);

    try {
      var messageForServer = displayText || payload;
      var response = await sendMessage({ message: messageForServer, actionPayload: payload || undefined });
      if (loadingNode && loadingNode.parentNode) {
        loadingNode.parentNode.removeChild(loadingNode);
      }

      var botEntry = {
        role: 'bot',
        text: response.reply || '',
        ui: response.ui || null,
        state: response.state || null
      };

      addMessage(botEntry, true);
      history = loadHistory();
      history.push(botEntry);
      saveHistory(history);

      var suggestions = botEntry.ui && botEntry.ui.suggestions ? botEntry.ui.suggestions : defaultSuggestions();
      setQuickChips(suggestions);
    } catch (err) {
      if (loadingNode && loadingNode.parentNode) {
        loadingNode.parentNode.removeChild(loadingNode);
      }
      var fallback = { role: 'bot', text: 'Hệ thống tạm lỗi, vui lòng thử lại sau.' };
      addMessage(fallback, false);
      history = loadHistory();
      history.push(fallback);
      saveHistory(history);
      setQuickChips(defaultSuggestions());
    } finally {
      setSending(false);
      input.focus();
    }
  }

  toggleBtn.addEventListener('click', function () {
    panel.classList.toggle('is-open');
    if (panel.classList.contains('is-open')) {
      input.focus();
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      panel.classList.remove('is-open');
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    submitUserMessage(input.value, null);
  });

  renderHistory();
})();
