import { useState } from "react";
import { useAuth } from "../lib/auth.ts";

export function UserMenu() {
  const { me } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    } catch (err) {
      alert("Erro ao fazer logout");
    }
  }

  if (!me) return null;

  const email = me.email || me.sub;
  const displayName = email.split("@")[0];

  return (
    <div style={styles.container}>
      <button
        style={styles.userBtn}
        onClick={() => setIsOpen(!isOpen)}
        title={email}
      >
        👤 {displayName}
      </button>
      {isOpen && (
        <>
          <div style={styles.overlay} onClick={() => setIsOpen(false)} />
          <div style={styles.dropdown}>
            <div style={styles.dropdownHeader}>
              <div style={styles.userInfo}>
                <div style={styles.userEmail}>{email}</div>
                {me.isAdmin && <div style={styles.adminBadge}>Admin</div>}
              </div>
            </div>
            <button style={styles.logoutOption} onClick={handleLogout}>
              🚪 Sair da conta
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
  },
  userBtn: {
    background: "#f5f0ff",
    color: "#7c5cbf",
    border: "1.5px solid #e2e0db",
    borderRadius: 10,
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 99,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    right: 0,
    marginTop: 8,
    background: "#fff",
    borderRadius: 10,
    border: "1.5px solid #e2e0db",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    minWidth: 200,
    zIndex: 100,
    overflow: "hidden",
  },
  dropdownHeader: {
    padding: "12px 14px",
    borderBottom: "1px solid #e2e0db",
    background: "#fafaf9",
  },
  userInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  userEmail: {
    fontSize: 12,
    color: "#6b6b6b",
    wordBreak: "break-word",
  },
  adminBadge: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    color: "#fff",
    background: "#7c5cbf",
    padding: "2px 8px",
    borderRadius: 4,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    width: "fit-content",
  },
  logoutOption: {
    display: "block",
    width: "100%",
    padding: "12px 14px",
    background: "none",
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    color: "#d97a7a",
    cursor: "pointer",
    textAlign: "left",
    transition: "background 0.15s",
  },
};
