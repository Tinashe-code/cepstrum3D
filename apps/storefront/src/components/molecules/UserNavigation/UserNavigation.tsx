"use client"
import {
  Badge,
  Card,
  Divider,
  LogoutButton,
  NavigationItem,
} from "@/components/atoms"
import { useUnreads } from "@talkjs/react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import { getUnreadNotificationCount } from "@/lib/data/notifications"

const navigationItems = [
  {
    label: "Orders",
    href: "/user/orders",
  },
  // {
  //   label: "Messages",
  //   href: "/user/messages",
  // },
  // {
  //   label: "Returns",
  //   href: "/user/returns",
  // },
  {
    label: "Notifications",
    href: "/user/notifications",
  },
  {
    label: "Favourites",
    href: "/user/wishlist",
  },
  {
    label: "Addresses",
    href: "/user/addresses",
  },
]

export const UserNavigation = () => {
  const unreads = useUnreads()
  const path = usePathname()
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  useEffect(() => {
    const load = () => getUnreadNotificationCount().then(setUnreadNotifications)
    load()
    window.addEventListener("notifications-read", load)
    return () => window.removeEventListener("notifications-read", load)
  }, [path])

  return (
    <Card className="h-min">
      {navigationItems.map((item) => (
        <NavigationItem
          key={item.label}
          href={item.href}
          active={path === item.href}
          className="relative"
        >
          {item.label}
          {item.label === "Notifications" && unreadNotifications > 0 && (
            <Badge
              className="absolute top-3 left-32 w-5 h-5 p-0"
              data-testid="notifications-unread-badge"
            >
              {unreadNotifications}
            </Badge>
          )}
          {item.label === "Messages" && Boolean(unreads?.length) && (
            <Badge className="absolute top-3 left-24 w-4 h-4 p-0">
              {unreads?.length}
            </Badge>
          )}
        </NavigationItem>
      ))}
      <Divider className="my-2" />
      <NavigationItem
        href={"/user/settings"}
        active={path === "/user/settings"}
      >
        Settings
      </NavigationItem>
      <LogoutButton className="w-full text-left" />
    </Card>
  )
}
