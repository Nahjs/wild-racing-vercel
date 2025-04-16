import { createRouter, createWebHistory } from 'vue-router'
import Garage from '../views/Garage.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/garage',
    name: 'Garage',
    component: Garage
  },
  {
    path: '/race',
    name: 'Race',
    component: () => import('../views/Race.vue')
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/Profile.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router 