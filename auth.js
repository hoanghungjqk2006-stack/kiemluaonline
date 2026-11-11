// Supabase Auth integration for Kiem Lua Online
(function(){
  let client = null;
  let user = null;
  let profile = null;
  const toast = (msg) => { const el=document.getElementById('toast'); if(el){el.textContent=msg;el.style.display='block';window.setTimeout(()=>el.style.display='none',3000);} };
  window.authPanelHTML = function(){
    if(user){ return '<div class="card" style="margin-top:12px"><b>Tài khoản Supabase</b><p class="muted">'+String(user.email||'').replace(/[&<>"']/g,'')+'</p><p class="muted">Vai trò: '+String(profile?.role||'member')+'</p><button class="btn light full" id="supabaseSignOut">Đăng xuất</button></div>'; }
    return '<div class="card" style="margin-top:12px"><b>🔐 Đăng nhập / Đăng ký thật</b><div class="field"><label>Tên hiển thị (khi đăng ký)</label><input id="sbName" placeholder="Tên của bạn"></div><div class="field"><label>Email</label><input id="sbEmail" type="email" autocomplete="email" placeholder="name@example.com"></div><div class="field"><label>Mật khẩu (ít nhất 8 ký tự)</label><input id="sbPassword" type="password" autocomplete="current-password" placeholder="Mật khẩu"></div><div class="field"><label>Mã giới thiệu (không bắt buộc)</label><input id="sbReferral" placeholder="Mã giới thiệu"></div><button class="btn full" id="sbLogin">Đăng nhập</button><button class="btn light full" style="margin-top:8px" id="sbRegister">Tạo tài khoản</button><p class="muted">Có thể cần xác nhận email theo cài đặt Supabase. Ví Lúa và rút tiền vẫn là demo.</p></div>';
  };
  async function refresh(){
    profile=null;
    if(user && client){ const {data}=await client.from('profiles').select('display_name,role,referral_code').eq('id',user.id).maybeSingle(); profile=data||null; }
    if(typeof window.render==='function' && window.page==='profile') window.render();
  }
  window.addEventListener('click', async (e)=>{
    if(e.target.id==='sbLogin'){ const email=document.getElementById('sbEmail')?.value.trim(); const password=document.getElementById('sbPassword')?.value; if(!email||!password){toast('Nhập email và mật khẩu.');return;} const {error}=await client.auth.signInWithPassword({email,password}); if(error)toast('Đăng nhập lỗi: '+error.message); else toast('Đăng nhập thành công.'); }
    if(e.target.id==='sbRegister'){ const email=document.getElementById('sbEmail')?.value.trim(); const password=document.getElementById('sbPassword')?.value; const display_name=document.getElementById('sbName')?.value.trim()||'Thành viên'; const referral_code=document.getElementById('sbReferral')?.value.trim().toUpperCase()||null; if(!email||!password){toast('Nhập email và mật khẩu.');return;} if(password.length<8){toast('Mật khẩu cần ít nhất 8 ký tự.');return;} const {data,error}=await client.auth.signUp({email,password,options:{data:{display_name,referral_code}}}); if(error)toast('Đăng ký lỗi: '+error.message); else if(!data.session)toast('Đã đăng ký. Hãy kiểm tra email xác nhận.'); else toast('Tạo tài khoản thành công.'); }
    if(e.target.id==='supabaseSignOut'){ const {error}=await client.auth.signOut(); if(error)toast('Lỗi đăng xuất: '+error.message); else toast('Đã đăng xuất.'); }
  });
  if(window.supabase && window.SUPABASE_CONFIG){
    client=window.supabase.createClient(window.SUPABASE_CONFIG.url,window.SUPABASE_CONFIG.publishableKey);
    client.auth.onAuthStateChange((_event,session)=>{ user=session?.user||null; window.setTimeout(refresh,0); });
    client.auth.getSession().then(({data})=>{user=data.session?.user||null;refresh();});
  } else { console.error('Không tải được Supabase SDK hoặc cấu hình.'); }
  const originalRender=window.render;
  if(typeof originalRender==='function'){ window.render=function(){ originalRender(); if(window.page==='profile'){ const screen=document.getElementById('screen'); if(screen){ const panel=document.createElement('div'); panel.innerHTML=window.authPanelHTML(); screen.appendChild(panel.firstElementChild); } } }; window.render(); }
})();