# Thoth - Divine Intelligence Platform

## 🌟 Professional Enterprise Features

### ✨ Enhanced UI/UX

#### 1. **Cinematic Intro Sequence**
- Professional animated intro with hieroglyphic particle effects
- Gold text fill animation with "THOTH" branding
- Eye of Horus pulsing animation
- Automatic 6-second sequence with skip option
- Smooth fade transitions

#### 2. **3D Model Integration**
- **Enterprise-grade Thoth 3D Model** with PBR materials:
  - **Obsidian Black**: Polished obsidian base (#080808) with high metalness (0.9) and low roughness (0.1)
  - **Gold Accents**: Emissive gold highlights (#D4AF37) with controlled intensity
  - **HDR Lighting**: Studio HDR environment for realistic reflections
  - **Interactive Controls**: Orbit controls with zoom and rotation
  - **Auto-rotate**: Smooth automatic rotation for presentation
  - **Professional Shadows**: Real-time shadow casting and receiving
  
**Model Location**: `/assets/models/thoth.glb`  
**HDR Environment**: `/assets/hdr/studio_small_03_4k.hdr`

#### 3. **Oracle Page Enhancements**
- 3D model hero section with gradient overlay
- Redesigned chat interface with obsidian glass morphism
- Professional message bubbles with gold accents
- Improved typing indicators
- Enterprise color scheme throughout

#### 4. **Authentication System**
- JWT-based authentication ready
- Professional Login/Register modal
- Auth context for global state management
- Token persistence in localStorage
- User session management
- Integration with backend auth endpoints

### 🎨 Design System

#### Color Palette
```css
--bg-void: #050505           /* Deep black background */
--bg-obsidian: #121212       /* Obsidian surfaces */
--gold-primary: #D4AF37      /* Primary gold */
--gold-light: #FFD700        /* Light gold accents */
--gold-dark: #B8941F         /* Dark gold shadows */
--text-main: #E0E0E0         /* Primary text */
```

#### Typography
- **Headers**: Cinzel (serif) - Professional, ancient aesthetic
- **Body**: Inter (sans-serif) - Clean, readable

### 🏗️ Architecture Improvements

#### Component Structure
```
client/
├── components/
│   ├── ThothModel.tsx        # 3D model component (NEW)
│   ├── AuthModal.tsx         # Authentication modal (NEW)
│   ├── IntroSequence.tsx     # Enhanced intro (UPDATED)
│   └── Header.tsx            # Auth-enabled header (UPDATED)
├── lib/
│   └── auth-context.tsx      # Auth state management (NEW)
├── pages/
│   └── OraclePage.tsx        # Enhanced with 3D model (UPDATED)
```

#### Deleted Legacy Files
- ✅ All `.jsx` files removed (migrated to TypeScript)
- ✅ `client/legacy/` directory (unused)
- ✅ AI-generated duplicate files cleaned

### 🔧 Technical Stack

#### 3D Graphics
- **React Three Fiber**: Canvas rendering
- **Three.js Drei**: Helper components (OrbitControls, Environment, etc.)
- **PBR Materials**: Physically Based Rendering for realistic materials
- **HDR Environments**: High Dynamic Range lighting

#### Authentication
- JWT token-based authentication
- Secure token storage
- Protected routes support
- User session context

#### UI Components
- Radix UI primitives
- TailwindCSS utility-first styling
- Custom obsidian/gold theme
- Glass morphism effects

### 📦 Assets Required

Ensure these files are in the `public/assets/` directory:
- `models/thoth.glb` - 3D Thoth model
- `hdr/studio_small_03_4k.hdr` - HDR environment map

### 🚀 Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### 🎯 Key Features

1. **Professional 3D Model**
   - Obsidian & gold PBR materials
   - Interactive rotation and zoom
   - HDR environment reflections
   - Smooth animations

2. **Enterprise Design**
   - Black & gold color scheme
   - Glass morphism UI
   - Cinzel typography
   - Professional spacing and shadows

3. **Authentication Flow**
   - Login/Register modals
   - JWT token management
   - Protected routes
   - User session persistence

4. **Performance Optimizations**
   - Lazy loading 3D assets
   - Suspense boundaries
   - Optimized animations
   - Clean TypeScript codebase

### 🔐 Backend Integration

The frontend is ready for JWT authentication. Update the API endpoints:

```typescript
// In AuthModal.tsx
const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
```

Expected backend response:
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "username": "username"
  }
}
```

### 📝 Notes

- The intro sequence plays once on app load
- 3D model is displayed on the Oracle page
- Authentication modals trigger from header buttons
- All styling uses CSS custom properties for easy theming
- Professional error handling and loading states included

---

**Developed by**: Professional Enterprise Team  
**Design System**: Black & Gold Obsidian Theme  
**Framework**: React 18 + TypeScript + Vite
