import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { authenticator } from "otplib";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function sendVerificationEmail(email: string, userId: string) {
  try {
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, userId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to send verification email");
    }

    return await response.json();
  } catch (error: any) {
    console.error("Error sending verification email:", error);
    throw error;
  }
}

export const getProxyParamsA = () => {
  return {
    proxy_type: "socks5",
    proxy_ip: process.env.PROXY_IP_A,
    proxy_port: process.env.PROXY_PORT_A,
    proxy_username: process.env.PROXY_USERNAME_A,
    proxy_password: process.env.PROXY_PASSWORD_A,
    proxy_country: "US",
    proxy_rotation_interval: 3600,
  };
};

export const getProxyParamsB = () => {
  return {
    proxy_type: "socks5",
    proxy_ip: process.env.PROXY_IP_B,
    proxy_port: process.env.PROXY_PORT_B,
    proxy_username: process.env.PROXY_USERNAME_B,
    proxy_password: process.env.PROXY_PASSWORD_B,
    proxy_country: "US",
    proxy_rotation_interval: 3600,
  };
};

export const generateTOTPCode = (secret: string) => {
  const token = authenticator.generate(secret);
  return token;
};
