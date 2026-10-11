"use client";

import { useEffect, useState } from "react";
import { Picto } from "@/components/bs/picto";
import { InstallHowto } from "@/components/bs/desk";
import { useInstall } from "@/lib/pwa";

/**
 * La proposition d'installer l'app, discrète : à partir de la troisième
 * visite, une seule fois. Chrome et Edge installent d'un clic ; sur iPhone
 * et Safari, on montre les trois gestes.
 */
export function PwaInstallPrompt() {
  const install = useInstall();
  const [visits, setVisits] = useState(0);
  const [hidden, setHidden] = useState(true);
  const [how, setHow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("be-stable-install-dismissed")) return;
      const v = Number(localStorage.getItem("be-stable-visits") ?? "0") + 1;
      localStorage.setItem("be-stable-visits", String(v));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisits(v);
      setHidden(false);
    } catch {}
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem("be-stable-install-dismissed", "1");
    } catch {}
  };

  const can = install.way === "bouton" || install.way === "ios" || install.way === "safari-mac";
  if (hidden || install.installed || visits < 3 || !can) return how ? <InstallHowto onClose={() => setHow(false)} /> : null;

  return (
    <>
      <div className="bs-install" role="region" aria-label="Installer l’app">
        <span className="bs-pic soft">
          <Picto name="install" />
        </span>
        <span className="tx">
          <b>Installe Be Stable</b>
          <span>Une icône sur ton écran, une fenêtre à part, même sans réseau.</span>
        </span>
        <button
          type="button"
          className="go"
          onClick={async () => {
            if (install.way === "bouton") {
              await install.prompt();
              dismiss();
            } else setHow(true);
          }}
        >
          {install.way === "bouton" ? "Installer" : "Comment"}
        </button>
        <button type="button" className="bs-x" style={{ float: "none", margin: 0 }} onClick={dismiss} aria-label="Ne plus proposer">
          <Picto name="x" size={18} />
        </button>
      </div>
      {how && <InstallHowto onClose={() => setHow(false)} />}
    </>
  );
}
