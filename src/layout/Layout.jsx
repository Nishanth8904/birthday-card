import React from 'react'
import { Outlet } from 'react-router'
import HeartTransition from '../components/HeartTransition'
import BackgroundMusic from '../components/BackgroundMusic'

const Layout = () => {
  return (
    <>
        <HeartTransition />
        <BackgroundMusic/>
        <Outlet />
        
    </>
  )
}

export default Layout