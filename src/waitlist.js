import { supabase } from './supabase.js';
window.supabaseClient = supabase;

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
      display.textContent = '127';
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
      const modal = document.getElementById('survey-modal-overlay');
      if (modal) {
        modal.style.display = 'flex';
        window.pendingSurveyEmail = email;
      }
    });

    input.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
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
    
    try {
      const { error } = await supabase.from('waitlist').insert([{ 
        email: email,
        platform: platform,
        key_feature: feature
      }]);
      
      if (error) {
        console.error('Supabase error:', error);
        // Robust check for duplicate email
        const isDuplicate = error.code === '23505' || 
                            error.message?.toLowerCase().includes('duplicate') ||
                            error.message?.toLowerCase().includes('already exists');
                            
        if (!isDuplicate) {
          alert(`Database Error: ${error.message}. Please make sure you have run the database.sql setup in your Supabase dashboard.`);
        }
      }
    } catch (err) {
      console.error('Critical error during insert:', err);
      alert('Critical Connection Error. Please check your internet or Supabase project status.');
    }
    
    // Redirect even if error (likely duplicate) to show position
    window.location.href = `/waitlist.html?email=${encodeURIComponent(email)}`;
  });
}

// Run everything on load
function bootstrap() {
  if (typeof window.supabase !== 'undefined') {
    updateCount();
    initWaitlist();
    initSurvey();

    // Enable Realtime updates for the counter
    supabase
      .channel('waitlist-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'waitlist' }, (payload) => {
        console.log('New signup detected! Updating counter...', payload);
        updateCount();
      })
      .subscribe();
      
  } else {
    // Retry if CDN script not yet loaded
    setTimeout(bootstrap, 100);
  }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  bootstrap();
} else {
  document.addEventListener('DOMContentLoaded', bootstrap);
}
