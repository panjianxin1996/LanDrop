import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppRouterComponent } from '@/router'
import './index.css'
import './app.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <AppRouterComponent />
    </React.StrictMode>
)
