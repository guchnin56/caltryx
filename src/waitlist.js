import { createClient } from '@supabase/supabase-js';

// 1. Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
window.supabaseClient = supabase; // Export for other scripts if needed

// 2. Waitlist Counter Logic
async function updateCount() {
  const display = document.getElementById('waitlist-count-display');
  if (!display || !supabase) return;
  
  try {
    const { count, error } = await supabase.from('waitlist').select('*', { count: 'exact', head: true });
    if (count !== null && !error) {
      let current = 0;
      const target = count;
      const step = Math.ceil(target / 50) || 1;
      const timer = setInterval(() => {
        current += step;
        if (current >= target) {
          display.textContent = target.toLocaleString();
          clearInterval(timer);
        } else {
          display.textContent = current.toLocaleString();
        }
      }, 30);
    } else {
      display.textContent = '127'; // Fallback social proof
    }
  } catch(e) {
    display.textContent = '127';
  }
}

// 3. Signup & Survey Logic
function initWaitlist() {
  const inputs = [
    { in: 'waitlist-input', btn: 'waitlist-btn' },
    { in: 'final-waitlist-input', btn: 'final-waitlist-btn' }
  ];

  inputs.forEach(({ in: inId, btn: btnId }) => {
    const input = document.getElementById(inId);
    const btn = document.getElementById(btnId);
    if (!input || !btn) return;

    btn.addEventListener('click', () => {
      const email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        input.style.outline = '2px solid #EF4444';
        setTimeout(() => input.style.outline = '', 1500);
        return;
      }
      // Open survey modal
      const modal = document.getElementById('survey-modal-overlay');
      if (modal) {
        modal.style.display = 'flex';
        window.pendingSurveyEmail = email;
      }
    });

    input.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
  });

  // Banner Waitlists in subpages
  document.querySelectorAll('.sp-wb-form button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const input = btn.closest('.sp-wb-form')?.querySelector('input');
      if (!input) return;
      const email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        input.style.outline = '2px solid #EF4444';
        setTimeout(() => input.style.outline = '', 1500);
        return;
      }
      
      btn.textContent = '...';
      const { error } = await supabase.from('waitlist').insert([{ email }]);
      if (!error) {
        input.value = '';
        input.placeholder = email;
        input.disabled = true;
        btn.textContent = "✓ You're in!";
        btn.disabled = true;
      } else {
        btn.textContent = 'Try again';
        console.error(error);
      }
    });
  });
}

// 4. Survey Modal Submission
function initSurvey() {
  const platSelect = document.getElementById('survey-platform');
  const featSelect = document.getElementById('survey-feature');
  const featOther = document.getElementById('survey-feature-other');
  const surveyBtn = document.getElementById('survey-submit-btn');

  if (!surveyBtn) return;

  featSelect?.addEventListener('change', () => {
    if (featOther) featOther.style.display = featSelect.value === 'Other' ? 'block' : 'none';
  });

  surveyBtn.addEventListener('click', async () => {
    const platform = platSelect?.value;
    const feature = featSelect?.value === 'Other' ? featOther?.value : featSelect?.value;
    
    if (!platform || !feature) {
      alert('Please answer both questions to secure your spot.');
      return;
    }
    
    surveyBtn.textContent = 'Securing spot...';
    const email = window.pendingSurveyEmail;
    
    const { error } = await supabase.from('waitlist').insert([{ 
      email: email,
      platform: platform,
      key_feature: feature
    }]);
    
    // Redirect even if error (likely duplicate) to show position
    window.location.href = `/waitlist.html?email=${encodeURIComponent(email)}`;
  });
}

// Run everything on load
document.addEventListener('DOMContentLoaded', () => {
  updateCount();
  initWaitlist();
  initSurvey();
});
