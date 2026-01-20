const jsPDF = window.jspdf;

let startTime = null;
let timerInterval = null;
let sessions = JSON.parse(localStorage.getItem('sessions')) || [];
let chart = null;

const clockInBtn = document.getElementById('clockInBtn');
const clockOutBtn = document.getElementById('clockOutBtn');
const currentTimeEl = document.getElementById('currentTime');
const sessionList = document.getElementById('sessionList');
const savePdfBtn = document.getElementById('savePdfBtn');
const minimizeBtn = document.getElementById('minimize-btn');
const fullBtn = document.getElementById('full-btn');
const closeBtn = document.getElementById('close-btn');

function updateTimer() {
  if (startTime) {
    const now = new Date();
    const elapsed = now - startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    currentTimeEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}

function clockIn() {
  startTime = new Date();
  clockInBtn.disabled = true;
  clockOutBtn.disabled = false;
  timerInterval = setInterval(updateTimer, 1000);
}

function clockOut() {
  if (startTime) {
    const endTime = new Date();
    const session = {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      duration: endTime - startTime
    };
    sessions.push(session);
    localStorage.setItem('sessions', JSON.stringify(sessions));
    startTime = null;
    clearInterval(timerInterval);
    currentTimeEl.textContent = '00:00:00';
    clockInBtn.disabled = false;
    clockOutBtn.disabled = true;
    updateSessionList();
    updateChart();
  }
}

function updateSessionList() {
  sessionList.innerHTML = '';
  const today = new Date().toDateString();
  sessions.filter(session => new Date(session.start).toDateString() === today).forEach(session => {
    const li = document.createElement('li');
    const start = new Date(session.start);
    const end = new Date(session.end);
    const duration = new Date(session.duration);
    li.textContent = `${start.toLocaleTimeString()} - ${end.toLocaleTimeString()} (${duration.getUTCHours()}h ${duration.getUTCMinutes()}m)`;
    sessionList.appendChild(li);
  });
}

function updateChart() {
  const ctx = document.getElementById('weeklyChart').getContext('2d');
  const weeklyData = getWeeklyData();
  if (chart) {
    chart.destroy();
  }
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Hours Worked',
        data: weeklyData,
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function getWeeklyData() {
  const now = new Date();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 1));
  const weeklyHours = [0, 0, 0, 0, 0, 0, 0];
  sessions.forEach(session => {
    const sessionDate = new Date(session.start);
    if (sessionDate >= startOfWeek) {
      const dayIndex = sessionDate.getDay() - 1;
      if (dayIndex >= 0) {
        weeklyHours[dayIndex] += session.duration / 3600000; // Convert to hours
      }
    }
  });
  return weeklyHours;
}

function savePdf() {
    if (typeof window.jspdf === 'undefined' || typeof Chart === 'undefined') {
        alert('Required libraries not loaded. Please refresh the page and try again.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weeklySessions = sessions.filter(session => {
        const sessionDate = new Date(session.start);
        return sessionDate >= startOfWeek && sessionDate <= endOfWeek;
    });

    const dailyData = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    days.forEach(day => dailyData[day] = 0);

    weeklySessions.forEach(session => {
        const sessionDate = new Date(session.start);
        const dayName = days[sessionDate.getDay()];
        dailyData[dayName] += session.duration;
    });

    const chartData = days.map(day => dailyData[day] / (1000 * 60 * 60));

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [{
                label: 'Hours Coded',
                data: chartData,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    setTimeout(() => {
        doc.setFontSize(16);
        const weekRange = `${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;
        doc.text(`Weekly Coding Report - ${weekRange}`, 20, 20);

        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 20, 30, 170, 85);

        doc.setFontSize(12);
        doc.text('Session Details:', 20, 130);
        let y = 140;
        weeklySessions.forEach(session => {
            const hours = Math.floor(session.duration / (1000 * 60 * 60));
            const minutes = Math.floor((session.duration % (1000 * 60 * 60)) / (1000 * 60));
            const durationStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            doc.text(`${session.start} - ${session.end} (${durationStr})`, 20, y);
            y += 10;
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
        });

        doc.save(`weekly-coding-report${weekRange}.pdf`);

        document.body.removeChild(canvas);
        chart.destroy();
    }, 500);
}

function clearSessions() {
    if (confirm('Are you sure you want to clear all sessions? This action cannot be undone.')) {
      sessions = [];
      localStorage.removeItem('sessions');
      updateSessionList();
      updateChart();
    }
}

clockInBtn.addEventListener('click', clockIn);
clockOutBtn.addEventListener('click', clockOut);
savePdfBtn.addEventListener('click', savePdf);
clearBtn.addEventListener('click', clearSessions);

minimizeBtn.addEventListener('click', () => {
  window.electronAPI.minimizeWindow();
});

closeBtn.addEventListener('click', () => {
  window.electronAPI.closeWindow();
});

fullBtn.addEventListener('click', () => {
  window.electronAPI.fullWindow();
  if (fullBtn.textContent === '▢') {
    fullBtn.textContent = '⬚';
  } else {
    fullBtn.textContent = '▢';
  }
});

updateSessionList();
updateChart();
