// Supabase authentication for Kiem Lua Online.
(function () {
  let client = null;
  let user = null;
  let profile = null;
  let busy = false;

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
    });
  }

  function notify(message) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.style.display = "block";
    window.setTimeout(function () { el.style.display = "none"; }, 3200);
  }

  function authCard() {
    if (!client) {
      return '<div class="card" style="margin-top:12px"><b>🔐 Kết nối tài khoản</b><p class="muted">Chưa tải được Supabase. Vui lòng tải lại trang hoặc kiểm tra cấu hình kết nối.</p></div>';
    }

    if (user) {
      const displayName = profile && profile.display_name ? profile.display_name : "Thành viên";
      const role = profile && profile.role === "admin" ? "Quản trị viên" : "Thành viên";
      const referral = profile && profile.referral_code ? profile.referral_code : "Đang tải...";
      return '<div class="card" style="margin-top:12px">' +
        '<b>🔐 Tài khoản của bạn</b>' +
        '<p style="margin:10px 0 3px"><b>' + escapeHTML(displayName) + '</b></p>' +
        '<p class="muted" style="margin:3px 0">' + escapeHTML(user.email || "") + '</p>' +
        '<div class="divider"></div>' +
        '<div class="row"><span class="muted">Vai trò</span><b>' + escapeHTML(role) + '</b></div>' +
        '<div class="row" style="margin-top:9px"><span class="muted">Mã giới thiệu</span><b>' + escapeHTML(referral) + '</b></div>' +
        '<button class="btn light full" id="supabaseSignOut" style="margin-top:14px">Đăng xuất</button>' +
        '<p class="muted" style="margin-top:9px">Tài khoản đã kết nối Supabase. Ví, nhiệm vụ và rút tiền vẫn cần hoàn thiện phần xử lý máy chủ.</p>' +
        '</div>';
    }

    return '<div class="card" style="margin-top:12px">' +
      '<b>🔐 Đăng nhập / Đăng ký</b>' +
      '<div class="field"><label>Tên hiển thị (khi đăng ký)</label><input id="sbName" autocomplete="name" placeholder="Tên của bạn"></div>' +
      '<div class="field"><label>Email</label><input id="sbEmail" type="email" autocomplete="email" placeholder="name@example.com"></div>' +
      '<div class="field"><label>Mật khẩu</label><input id="sbPassword" type="password" autocomplete="current-password" minlength="8" placeholder="Ít nhất 8 ký tự"></div>' +
      '<div class="field"><label>Mã giới thiệu (không bắt buộc)</label><input id="sbReferral" autocomplete="off" placeholder="Mã giới thiệu"></div>' +
      '<button class="btn full" id="sbLogin">Đăng nhập</button>' +
      '<button class="btn light full" id="sbRegister" style="margin-top:8px">Tạo tài khoản mới</button>' +
      '<p class="muted" style="margin-top:10px">Nếu đăng ký yêu cầu xác nhận, hãy mở email và nhấn liên kết xác nhận. Không chia sẻ mật khẩu hoặc mã OTP.</p>' +
      '</div>';
  }

  async function refreshProfile() {
    profile = null;
    if (user && client) {
      const result = await client.from("profiles")
        .select("display_name, role, referral_code")
        .eq("id", user.id)
        .maybeSingle();
      if (result.error) {
        console.error("Không đọc được hồ sơ:", result.error.message);
      } else {
        profile = result.data || null;
      }
    }
    if (typeof window.render === "function") window.render();
  }

  function setSession(session) {
    user = session && session.user ? session.user : null;
    refreshProfile();
  }

  document.addEventListener("click", async function (event) {
    const button = event.target.closest("button");
    if (!button || !["sbLogin", "sbRegister", "supabaseSignOut"].includes(button.id)) return;
    if (!client) {
      notify("Chưa kết nối được Supabase. Hãy tải lại trang.");
      return;
    }
    if (busy) return;

    busy = true;
    button.disabled = true;
    const email = document.getElementById("sbEmail")?.value.trim() || "";
    const password = document.getElementById("sbPassword")?.value || "";

    try {
      if (button.id === "sbLogin") {
        if (!email || !password) {
          notify("Vui lòng nhập email và mật khẩu.");
        } else {
          const result = await client.auth.signInWithPassword({ email: email, password: password });
          if (result.error) notify("Đăng nhập chưa thành công: " + result.error.message);
          else notify("Đăng nhập thành công!");
        }
      } else if (button.id === "sbRegister") {
        const displayName = document.getElementById("sbName")?.value.trim() || "Thành viên";
        const referralCode = document.getElementById("sbReferral")?.value.trim().toUpperCase() || null;
        if (!email || !password) {
          notify("Vui lòng nhập email và mật khẩu.");
        } else if (password.length < 8) {
          notify("Mật khẩu cần có ít nhất 8 ký tự.");
        } else {
          const result = await client.auth.signUp({
            email: email,
            password: password,
            options: {
              emailRedirectTo: window.location.origin,
              data: { display_name: displayName, referral_code: referralCode }
            }
          });
          if (result.error) notify("Đăng ký chưa thành công: " + result.error.message);
          else if (result.data && !result.data.session) notify("Đã đăng ký. Hãy kiểm tra email để xác nhận tài khoản.");
          else notify("Tạo tài khoản thành công!");
        }
      } else if (button.id === "supabaseSignOut") {
        const result = await client.auth.signOut();
        if (result.error) notify("Đăng xuất chưa thành công: " + result.error.message);
        else notify("Đã đăng xuất.");
      }
    } catch (error) {
      notify("Có lỗi kết nối. Vui lòng thử lại.");
      console.error(error);
    } finally {
      busy = false;
      button.disabled = false;
    }
  });

  const originalRender = window.render;
  if (typeof originalRender === "function") {
    window.render = function () {
      originalRender();
      const screen = document.getElementById("screen");
      if (screen && screen.innerHTML.includes("Hồ sơ cá nhân")) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = authCard();
        if (wrapper.firstElementChild) screen.appendChild(wrapper.firstElementChild);
      }
    };
  }

  if (window.supabase && window.SUPABASE_CONFIG) {
    client = window.supabase.createClient(
      window.SUPABASE_CONFIG.url,
      window.SUPABASE_CONFIG.publishableKey
    );
    client.auth.onAuthStateChange(function (_event, session) {
      window.setTimeout(function () { setSession(session); }, 0);
    });
    client.auth.getSession().then(function (result) {
      setSession(result.data ? result.data.session : null);
    }).catch(function (error) {
      console.error("Không lấy được phiên đăng nhập:", error);
    });
  } else {
    console.error("Thiếu Supabase SDK hoặc supabase-config.js.");
  }

  if (typeof window.render === "function") window.render();
})();
