import React, { useState, useEffect } from "react";

export function Icon({ name, size = 20, ...props }) {
  const paths = {
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    file: "M14 2H5v20h14V7z M14 2v5h5 M8 12h8 M8 16h6",
    calendar: "M4 5h16v16H4z M8 2v6 M16 2v6 M4 10h16",
    shield: "M12 2l8 3v6c0 5-8 11-8 11S4 16 4 11V5z M8 11l3 3 5-6",
    bell: "M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
    arrow: "M5 12h14 M13 6l6 6-6 6",
    plus: "M12 5v14 M5 12h14",
    search: "M21 21l-6-6 M10 3a7 7 0 110 14 7 7 0 010-14",
    download: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
    check: "M5 12l4 4L19 6",
    close: "M6 6l12 12 M6 18L18 6",
    chart: "M4 3v18h17 M8 16v-4 M13 16V7 M18 16v-7",
    logout: "M9 4H4v16h5 M10 12h11 M17 8l4 4-4 4",
    clock: "M12 8v4l3 2 M12 3a9 9 0 110 18 9 9 0 010-18",
    link: "M9 15l6-6 M7 14l-2 2a3 3 0 004 4l4-4 M11 8l4-4a3 3 0 014 4l-2 2",
    chevron: "M9 5l7 7-7 7",
    upload: "M12 16V3 M7 8l5-5 5 5 M4 16v5h16v-5",
    info: "M12 11v6 M12 7v1 M12 2a10 10 0 110 20 10 10 0 010-20",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d={paths[name] || paths.file} />
    </svg>
  );
}
