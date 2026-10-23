import React, { useState, useEffect } from "react";

export function Logo() {
  return (
    <div className="logo">
      <img
        className="brand-mark"
        src="/trustchain-logo.png"
        alt=""
        width="48"
        height="48"
      />
      TrustChain<span className="logo-dot">.</span>
    </div>
  );
}
