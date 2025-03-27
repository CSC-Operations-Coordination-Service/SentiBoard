import unittest

from apps.elastic.modules.timeliness_statistics import timeliness_convert_to_hour


class TimelinessStatsTest(unittest.TestCase):
    def test_convert_to_hour(self):
        query_result = {'timeliness_statistics':
                            {'count': 20635,
                             'min': 127118870000.0,
                             'max': 582827662000.0,
                             'avg': 146174756861.30692,
                             'sum': 3016316107833068.0,
                             'sum_of_squares': 4.984272344666736e+26,
                             'variance': 2.7873981481624095e+21,
                             'variance_population': 2.7873981481624095e+21,
                             'variance_sampling': 2.7875332357919605e+21,
                             'std_deviation': 52795815631.18813,
                             'std_deviation_population': 52795815631.18813,
                             'std_deviation_sampling': 52797094955.99129,
                             'std_deviation_bounds': {
                                 'upper': 251766388123.68317,
                                 'lower': 40583125598.93065,
                                 'upper_population': 251766388123.68317,
                                 'lower_population': 40583125598.93065,
                                 'upper_sampling': 251768946773.2895,
                                 'lower_sampling': 40580566949.32434
                             }
                             },
                        'timeliness_outliers': {
                            'values': {
                                '1.0': 130983484928.57143,
                                '5.0': 131162251938.37076,
                                '25.0': 134124331469.49522,
                                '50.0': 136239573183.85257,
                                '75.0': 139518072481.60724,
                                '95.0': 152633217852.08163,
                                '99.0': 481341200600.0025}}}
        timeliness_convert_to_hour(query_result)
        self.assertEqual(query_result['timeliness_statistics']['count'], 20635)
        self.assertEqual(round(query_result['timeliness_statistics']['min'], 4), 35.3108)

    def test_convert_to_hour_no_results(self):
        query_results = {'timeliness_statistics': {'count': 0,
                                                   'min': None, 'max': None,
                                                   'avg': None,
                                                   'sum': 0.0, 'sum_of_squares': None,
                                                   'variance': None, 'variance_population': None,
                                                   'variance_sampling': None,
                                                   'std_deviation': None, 'std_deviation_population': None,
                                                   'std_deviation_sampling': None,
                                                   'std_deviation_bounds': {
                                                       'upper': None, 'lower': None,
                                                       'upper_population': None, 'lower_population': None,
                                                       'upper_sampling': None, 'lower_sampling': None
                                                   }
                                                   },
                         'timeliness_outliers': {
                             'values': {
                                 '1.0': None,
                                 '5.0': None,
                                 '25.0': None,
                                 '50.0': None,
                                 '75.0': None,
                                 '95.0': None,
                                 '99.0': None}}}
        with self.assertRaises(Exception) as raises_cm:
            updated_query_result = timeliness_convert_to_hour(query_results)
            excep = raises_cm.exception
            print(excep)


if __name__ == '__main__':
    unittest.main()
