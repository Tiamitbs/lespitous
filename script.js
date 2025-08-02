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
