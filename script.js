// script.js
// Bulle "WOUF !" au survol des chiens
document.querySelectorAll('.side-image').forEach(img => {
  img.addEventListener('mouseenter', () => {
    let bubble = document.createElement('div');
    bubble.className = 'bulle-wouf';
    bubble.innerText = 'WOUF !';
    img.parentElement.appendChild(bubble);
    let rect = img.getBoundingClientRect();
    bubble.style.position = 'absolute';
    bubble.style.top = (img.offsetTop - 40) + 'px';
    bubble.style.left = (img.offsetLeft + img.offsetWidth / 2 - 30) + 'px';
    bubble.style.background = 'yellow';
    bubble.style.padding = '5px 10px';
    bubble.style.borderRadius = '10px';
    bubble.style.fontWeight = 'bold';
    bubble.style.animation = 'pop 0.5s';
    setTimeout(() => bubble.remove(), 1500);
  });
});

// Traces de pattes au clic
document.addEventListener('click', (e) => {
  const paw = document.createElement('img');
  paw.src = 'images/patteChien.png';
  paw.className = 'patteChien';
  paw.style.position = 'absolute';
  paw.style.left = `${e.clientX - 25}px`;
  paw.style.top = `${e.clientY - 25}px`;
  paw.style.width = '50px';
  paw.style.height = '50px';
  paw.style.pointerEvents = 'none';
  document.body.appendChild(paw);

  setTimeout(() => {
    paw.remove();
  }, 2000);
});


// Popup rigolo au clic sur Télécharger
    document.getElementById('downloadBtn').addEventListener('click', (e) => {
      e.preventDefault();
      const popup = document.createElement('div');
      popup.innerText = 'Oh non ! Les Pitous sont en train de finir l\'application ! 🐶🛠️';
      popup.style.position = 'fixed';
      popup.style.top = '50%';
      popup.style.left = '50%';
      popup.style.transform = 'translate(-50%, -50%)';
      popup.style.background = '#fff8dc';
      popup.style.border = '3px solid #ff6600';
      popup.style.padding = '20px';
      popup.style.borderRadius = '20px';
      popup.style.fontSize = '1.2em';
      popup.style.fontWeight = 'bold';
      popup.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
      popup.style.zIndex = '2000';
      document.body.appendChild(popup);
      setTimeout(() => popup.remove(), 3000);
    });