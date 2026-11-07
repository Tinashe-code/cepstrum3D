import {
  ProductPageAccordion,
  ProdutMeasurementRow,
} from '@/components/molecules';
import { SingleProductMeasurement } from '@/types/product';

export const ProductDetailsMeasurements = ({
  measurements,
}: {
  measurements: SingleProductMeasurement[];
}) => {
  return (
    <ProductPageAccordion
      heading='Measurements'
      defaultOpen
    >
      {measurements.map((item) => (
        <ProdutMeasurementRow
          key={item.label}
          measurement={item}
        />
      ))}
    </ProductPageAccordion>
  );
};
