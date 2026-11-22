// Scam tactics guide: Owlbert in the header, and "Try this example" opens the checker with it.
// The example travels in sessionStorage (this tab only), never in the address bar.
(() => {
  const owl = document.getElementById("guideOwl");
  if (owl && window.Owl) owl.innerHTML = Owl.svg("careful");
  document.querySelectorAll(".try-btn").forEach(btn => btn.addEventListener("click", () => {
    try { sessionStorage.setItem("scamshield-try", btn.dataset.example); } catch (e) {}
    location.href = "/#detector";
  }));
})();
