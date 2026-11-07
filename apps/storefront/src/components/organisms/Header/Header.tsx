import Image from "next/image"
import { HttpTypes } from "@medusajs/types"

import { CartDropdown, MobileNavbar, Navbar } from "@/components/cells"
import { UserDropdown } from "@/components/cells/UserDropdown/UserDropdown"
import CountrySelector from "@/components/molecules/CountrySelector/CountrySelector"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { MessageButton } from "@/components/molecules/MessageButton/MessageButton"
import { listCategories } from "@/lib/data/categories"
import { listRegions } from "@/lib/data/regions"
import { retrieveCustomer } from "@/lib/data/customer"
import { ParentCategoryLinks } from "@/components/molecules/ParentCategoryLinks/ParentCategoryLinks"
import { SiteLogo } from "@/components/atoms/SiteLogo/SiteLogo"

export const Header = async ({ locale } : {
  locale: string
}) => {
  const user = await retrieveCustomer().catch(() => null)
  const isLoggedIn = Boolean(user)

  const regions = await listRegions()

  const { categories, parentCategories } = (await listCategories({ query: { include_ancestors_tree: true } })) as {
    categories: HttpTypes.StoreProductCategory[]
    parentCategories: HttpTypes.StoreProductCategory[]
  }
  return (
    <header data-testid="header">
      <div
        className="bg-accent text-white text-xs sm:text-sm font-medium"
        data-testid="header-announcement"
      >
        <div className="flex items-center justify-center gap-x-6 gap-y-1 flex-wrap px-4 py-2 text-center">
          <span>🚚 Delivery across Zimbabwe</span>
          <span className="hidden sm:inline">💵 Pay on delivery on most items</span>
          <span className="hidden md:inline">📱 EcoCash · OneMoney · Card</span>
        </div>
      </div>
      <div className="flex py-2 lg:px-8 px-4 md:px-5" data-testid="header-top">
        <div className="flex items-center xl:w-2/5">
          <MobileNavbar
            parentCategories={parentCategories}
            categories={categories}
          />
          <ParentCategoryLinks
            parentCategories={parentCategories}
            categories={categories}
          />
        </div>
        <div className="flex lg:justify-center lg:w-1/3 xl:w-1/5 items-center pl-4 lg:pl-0">
          <LocalizedClientLink href="/" className="text-2xl font-bold" data-testid="header-logo-link">
            <SiteLogo />
          </LocalizedClientLink>
        </div>
        <div className="flex items-center justify-end gap-2 lg:gap-4 w-full lg:w-1/3 xl:w-2/5 py-2" data-testid="header-actions">
          <CountrySelector regions={regions} />
          {isLoggedIn && <MessageButton />}
          <UserDropdown isLoggedIn={isLoggedIn} />
          <CartDropdown />
        </div>
      </div>
      <Navbar categories={categories} parentCategories={parentCategories} />
    </header>
  )
}
