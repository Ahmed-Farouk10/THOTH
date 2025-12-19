export default function Footer() {
  return (
    <footer style={{
      background: 'rgb(44, 36, 22)',
      padding: '64px 20px 32px',
      textAlign: 'center',
      borderTop: '4px solid rgb(184, 148, 31)'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'rgb(212, 175, 55)', marginBottom: '24px' }}>THOTH</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
          <a href="#" style={{ color: 'rgb(232, 221, 200)', textDecoration: 'none', transition: 'color 0.3s' }}>Temple Laws</a>
          <a href="#" style={{ color: 'rgb(232, 221, 200)', textDecoration: 'none', transition: 'color 0.3s' }}>Pantheon</a>
        </div>
        <div style={{ color: 'rgb(216, 201, 168)', fontSize: '14px' }}>
          &copy; 2024 Temple of Thoth. All wisdom preserved.
        </div>
      </div>
    </footer>
  );
}
