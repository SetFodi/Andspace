import type { SVGProps } from "react";

const baseProps: SVGProps<SVGSVGElement> = {
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true,
};

export function FolderClosedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path
        d="M2 4.4c0-.77 0-1.16.15-1.45a1.4 1.4 0 0 1 .61-.61C3.05 2.2 3.43 2.2 4.2 2.2h1.6c.34 0 .51 0 .67.04.14.04.27.1.4.2.13.08.24.2.47.43l.32.32c.23.23.34.34.47.42a1.4 1.4 0 0 0 .4.2c.16.05.33.05.67.05h2.6c.77 0 1.15 0 1.44.15.26.13.48.35.61.61.15.29.15.68.15 1.45v5.2c0 .77 0 1.16-.15 1.45a1.4 1.4 0 0 1-.61.61c-.29.15-.67.15-1.44.15H4.2c-.77 0-1.16 0-1.44-.15a1.4 1.4 0 0 1-.61-.61C2 11.96 2 11.57 2 10.8V4.4Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FolderOpenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path
        d="M2 4.4c0-.77 0-1.16.15-1.45a1.4 1.4 0 0 1 .61-.61C3.05 2.2 3.43 2.2 4.2 2.2h1.6c.34 0 .51 0 .67.04.14.04.27.1.4.2.13.08.24.2.47.43l.32.32c.23.23.34.34.47.42a1.4 1.4 0 0 0 .4.2c.16.05.33.05.67.05h2.6c.77 0 1.15 0 1.44.15.26.13.48.35.61.61.15.29.15.68.15 1.45V7"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M2.2 13.5h9.2c.5 0 .92-.34 1.05-.82l1.18-4.2c.18-.65-.31-1.28-.99-1.28H4.94a1.05 1.05 0 0 0-1.02.78L2.6 12.4c-.18.66.32 1.1.6 1.1Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path
        d="M4.5 2h4.2c.18 0 .27 0 .35.02a.7.7 0 0 1 .18.07c.07.04.13.1.26.23l2.67 2.67c.13.13.2.2.24.27a.7.7 0 0 1 .07.18c.02.08.02.17.02.35V12.5c0 .56 0 .84-.11 1.06a1 1 0 0 1-.44.43c-.21.11-.5.11-1.06.11h-6.4c-.56 0-.84 0-1.06-.11a1 1 0 0 1-.43-.43c-.11-.22-.11-.5-.11-1.06v-9c0-.56 0-.84.11-1.06A1 1 0 0 1 3.44 2C3.66 2 3.94 2 4.5 2Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M9 2.2v2.4c0 .37 0 .56.07.7a.7.7 0 0 0 .3.31c.15.08.34.08.7.08h2.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FileCodeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path
        d="M4.5 2h4.2c.18 0 .27 0 .35.02a.7.7 0 0 1 .18.07c.07.04.13.1.26.23l2.67 2.67c.13.13.2.2.24.27a.7.7 0 0 1 .07.18c.02.08.02.17.02.35V12.5c0 .56 0 .84-.11 1.06a1 1 0 0 1-.44.43c-.21.11-.5.11-1.06.11h-6.4c-.56 0-.84 0-1.06-.11a1 1 0 0 1-.43-.43c-.11-.22-.11-.5-.11-1.06v-9c0-.56 0-.84.11-1.06A1 1 0 0 1 3.44 2C3.66 2 3.94 2 4.5 2Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="m6.8 8.6-1.2 1.2 1.2 1.2M9.2 8.6l1.2 1.2-1.2 1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FileTextIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path
        d="M4.5 2h4.2c.18 0 .27 0 .35.02a.7.7 0 0 1 .18.07c.07.04.13.1.26.23l2.67 2.67c.13.13.2.2.24.27a.7.7 0 0 1 .07.18c.02.08.02.17.02.35V12.5c0 .56 0 .84-.11 1.06a1 1 0 0 1-.44.43c-.21.11-.5.11-1.06.11h-6.4c-.56 0-.84 0-1.06-.11a1 1 0 0 1-.43-.43c-.11-.22-.11-.5-.11-1.06v-9c0-.56 0-.84.11-1.06A1 1 0 0 1 3.44 2C3.66 2 3.94 2 4.5 2Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M5.6 8.4h4.8M5.6 10.4h3.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function FileHiddenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path
        d="M4.5 2h4.2c.18 0 .27 0 .35.02a.7.7 0 0 1 .18.07c.07.04.13.1.26.23l2.67 2.67c.13.13.2.2.24.27a.7.7 0 0 1 .07.18c.02.08.02.17.02.35V12.5c0 .56 0 .84-.11 1.06a1 1 0 0 1-.44.43c-.21.11-.5.11-1.06.11h-6.4c-.56 0-.84 0-1.06-.11a1 1 0 0 1-.43-.43c-.11-.22-.11-.5-.11-1.06v-9c0-.56 0-.84.11-1.06A1 1 0 0 1 3.44 2C3.66 2 3.94 2 4.5 2Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="10" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path
        d="M5.5 3.6c0-.46 0-.7.1-.83a.5.5 0 0 1 .4-.2c.16 0 .35.13.74.4l6 4.4c.32.24.48.36.54.5.05.13.05.27 0 .4-.06.14-.22.26-.54.5l-6 4.4c-.39.27-.58.4-.74.4a.5.5 0 0 1-.4-.2c-.1-.13-.1-.37-.1-.83V3.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function RefreshIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props}>
      <path
        d="M13.5 7a5.5 5.5 0 1 0-1.7 4M13.5 3v4h-4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronIcon({
  open,
  ...rest
}: SVGProps<SVGSVGElement> & { open: boolean }) {
  return (
    <svg
      {...baseProps}
      {...rest}
      style={{
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 140ms cubic-bezier(0.32, 0.72, 0, 1)",
        ...rest.style,
      }}
    >
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
