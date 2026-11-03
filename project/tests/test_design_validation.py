"""Regressions for semantic design constraints that shape the playable world."""
import contextlib
import copy
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import sync_runtime
import validate_docs


class LadderValidation(unittest.TestCase):
    def test_empty_island_is_not_a_valid_return_ladder(self):
        layout = copy.deepcopy(validate_docs.read_json('anchors.json'))
        island = 'island-1'
        descendants, frontier = set(), {island}
        while frontier:
            frontier = {i['id'] for i in layout['instances'] if i['carrier'] in frontier}
            descendants |= frontier
        layout['instances'] = [i for i in layout['instances'] if i['id'] not in descendants]
        layout['scatter'] = [g for g in layout['scatter'] if g['carrier'] not in descendants | {island}]
        original_read = validate_docs.read_json
        # Ignore stale generated files: this test isolates the source layout's semantics.
        generated = {p: json.loads((validate_docs.ROOT / p).read_text(encoding='utf-8'))
                     for p in sync_runtime.generate()}
        with patch.object(validate_docs, 'read_json', side_effect=lambda n: layout if n == 'anchors.json' else original_read(n)), \
                patch.object(validate_docs, 'errors', []), patch.object(validate_docs, 'checks', 0), \
                patch.object(sync_runtime, 'generate', return_value=generated), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(validate_docs.main(), 1)
            self.assertTrue(any(f'{island}: ladder broken' in e for e in validate_docs.errors))


class ScaleRelations(unittest.TestCase):
    def test_empty_tiers_and_explicit_allow_deny(self):
        source = {'scaleTiers': [{'id': t} for t in ['small', 'reserved', 'medium', 'large']],
                  'entities': [{'id': 'a', 'scaleTier': 'small',
                                'relationOverrides': {'allow': ['c'], 'deny': ['b'], 'decision': 'D-021'}},
                               {'id': 'b', 'scaleTier': 'medium'}, {'id': 'c', 'scaleTier': 'large'}]}
        ranks, relations = sync_runtime.scale_relations(source)
        self.assertEqual(ranks, {'small': 0, 'medium': 1, 'large': 2})
        self.assertIn('c', relations['a'])
        self.assertNotIn('b', relations['a'])
        self.assertIn('a', relations['b'])


if __name__ == '__main__':
    unittest.main()
