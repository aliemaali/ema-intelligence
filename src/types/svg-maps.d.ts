declare module '@svg-maps/germany' {
  type SvgMapLocation = {
    id: string
    name: string
    path: string
  }

  const GermanyMap: {
    label: string
    viewBox: string
    locations: SvgMapLocation[]
  }

  export default GermanyMap
}
